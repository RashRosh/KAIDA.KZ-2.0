param(
    [ValidateRange(1024, 65535)] [int] $Port = 58887,
    [string] $Image = 'sha256:e1929ae2818226284d7ef007329098a30851c11528ab3712bc9c8d68da78278b'
)

$ErrorActionPreference = 'Stop'
$mapUrl = 'https://download.geofabrik.de/asia/kazakhstan/kazakhstan-latest.osm.pbf'
$name = 'kaida-road-distance-osrm'

function Invoke-Docker {
    & docker.exe @args
    if ($LASTEXITCODE -ne 0) { throw "Docker command '$($args[0])' failed ($LASTEXITCODE)." }
}

$engine = Invoke-Docker info --format '{{.OSType}}'
if ($engine -ne 'linux') { throw 'Use the Linux Docker engine.' }
$imageId = Invoke-Docker image inspect --format '{{.Id}}' $Image
$existing = Invoke-Docker ps --all --format '{{.Names}}'
if ($existing -contains $name) { throw "Container $name already exists. Use it or remove it before building a new graph." }

$graph = Join-Path ([IO.Path]::GetTempPath()) ('kaida-osrm-pilot-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $graph
$pbf = Join-Path $graph 'kazakhstan.osm.pbf'
& curl.exe --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 1200 --output $pbf $mapUrl
if ($LASTEXITCODE -ne 0) { throw 'Kazakhstan map download failed.' }
$mapHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $pbf).Hash.ToLowerInvariant()
$mount = "type=bind,source=$graph,target=/data"
Write-Host "OSRM image: $imageId"
Write-Host "OSM map SHA256: $mapHash"

$build = [Diagnostics.Stopwatch]::StartNew()
foreach ($step in @('extract', 'partition', 'customize')) {
    $arguments = if ($step -eq 'extract') {
        @('-t', '4', '-p', '/opt/car.lua', '/data/kazakhstan.osm.pbf')
    } else {
        @('-t', '4', '/data/kazakhstan.osrm')
    }
    # The Linux container reports its cgroup peak, including mapped graph data.
    $measure = '$@; result=$?; if test -r /sys/fs/cgroup/memory.peak; then echo Peak_memory_bytes; cat /sys/fs/cgroup/memory.peak; fi; exit $result'
    Invoke-Docker run --rm --mount $mount --entrypoint /bin/sh $imageId -c $measure measure "osrm-$step" @arguments | Out-Host
}
$build.Stop()
Write-Host ('Graph build seconds: {0:N1}' -f $build.Elapsed.TotalSeconds)

$id = Invoke-Docker run --detach --name $name --publish "127.0.0.1:${Port}:5000" --mount "$mount,readonly" --env DISABLE_ACCESS_LOGGING=1 $imageId osrm-routed --algorithm mld -t 2 /data/kazakhstan.osrm
$baseUrl = "http://127.0.0.1:$Port/"
$sanity = $baseUrl + 'table/v1/driving/76.945093,43.246272;76.955077,43.263577?annotations=distance&sources=0&destinations=1'
$start = [Diagnostics.Stopwatch]::StartNew()
$ready = $false
while ($start.Elapsed.TotalSeconds -lt 45) {
    try {
        $response = Invoke-RestMethod -Uri $sanity -TimeoutSec 2
        if ($response.code -eq 'Ok' -and $null -ne $response.distances[0][0]) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $ready) {
    Invoke-Docker logs $id | Out-Host
    Invoke-Docker stop $id | Out-Null
    throw 'OSRM did not return a route to the pilot test point.'
}
$memory = Invoke-Docker stats --no-stream --format '{{.MemUsage}}' $id
Write-Host "OSRM_BASE_URL=$baseUrl"
Write-Host "OSRM_GRAPH_VERSION=$imageId/$mapHash"
Write-Host "Container memory: $memory"
Write-Host "Graph directory: $graph"
Write-Host "To stop it: docker stop $name"
Write-Host "To restart it with the same graph: docker start $name"
