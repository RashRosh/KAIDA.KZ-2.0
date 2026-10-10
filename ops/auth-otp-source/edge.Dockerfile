# The official2.11.7 image still embeds Go1.26.8/x-net0.59.0 with four fixable HIGH findings.
# Build the same release/standard modules using the supplied fixes; isolated local reference only.
FROM golang:1.26.9-alpine@sha256:3082400e369fa24d5fc60bca20edab3f6d604e0c5a690ec66b295eff4dd87ade AS build
ENV CGO_ENABLED=0 GOMAXPROCS=1 GOGC=25 GOMEMLIMIT=768MiB
WORKDIR /build
COPY ops/auth-otp-source/edge-main.go ./main.go
RUN go mod init local/source-ingress \
    && go get github.com/caddyserver/caddy/v2@v2.11.7 golang.org/x/net@v0.60.0 \
    && go mod tidy \
    && go build -p 1 -trimpath -ldflags="-s -w" -o /usr/bin/caddy .
FROM caddy:2.11.7-alpine@sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f
COPY --from=build /usr/bin/caddy /usr/bin/caddy
RUN chown -R 1000:1000 /config /data
USER 1000:1000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/api/health"]
