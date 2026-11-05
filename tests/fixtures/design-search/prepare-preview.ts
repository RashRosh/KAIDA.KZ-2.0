// Explicit local acceptance fixture only; never imported by the application or CI setup.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { Pool } from 'pg';
import { createDiskPhotoStorage } from '../../../src/modules/media/storage/photo-storage';
import { offerTitleSearchText } from '../../../src/modules/offers/title/offer-title';
import { templateOpeningHours } from '../../../src/modules/locations/hours/opening-hours';

const url=new URL(process.env.DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/kaida_design') throw new Error('Only the isolated kaida_design preview at55439 is allowed');
const pool=new Pool({connectionString:url.href,max:1});
const id=(n:number)=>`a4700000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=[
  ['Помидоры розовые тепличные','1450','Павильон 12 · Зелёный базар','ул. Рыскулова, 58','Айгерим К.',120,1200,'tomatoes'],
  ['Помидоры «Бычье сердце» отборные, крупные, ящик 3 кг, сорт Малиновый гигант','650','Магазин «Свежий ряд»','пр. Абая, 150','Нурлан Б.',4320,2800,'bullheart'],
  ['Помидоры черри, упаковка 250 г','1190','Дом. точка «Алмагуль»','мкр. Орбита-2, 14','Алмагуль С.',40,5100,null],
  ['Помидоры алматинские, грунт','890','Рынок «Жетысу», ряд 7','ул. Тастак, 21','Серик Т.',1440,3400,'ground'],
] as const;
try {
  await pool.query('BEGIN');
  for(const [i,row] of rows.entries()) {
    const owner=id(100+i),seller=id(20+i),point=id(30+i),offer=id(i+1),photo=id(40+i);
    await pool.query('INSERT INTO users(id,phone_e164,created_at) VALUES($1,$2,now()) ON CONFLICT(id) DO NOTHING',[owner,`+7700029040${i+1}`]);
    await pool.query('INSERT INTO sellers(id,owner_user_id,display_name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name',[seller,owner,row[4]]);
    const phone=i!==2?'+77000000001':null, whatsapp=i===0||i===2?'+77000000001':null,telegram=i===0?'kaida_test':null;
    await pool.query(`INSERT INTO locations(id,seller_id,name,address_text,type,latitude,longitude,phone_e164,whatsapp_phone_e164,telegram_username,opening_hours,opening_hours_needs_review)
      VALUES($1,$2,$3,$4,'shop',$5,76.95,$6,$7,$8,$9,false) ON CONFLICT(id) DO UPDATE SET name=excluded.name,address_text=excluded.address_text`,
      [point,seller,row[2],row[3],43.25+row[6]/111195,phone,whatsapp,telegram,JSON.stringify(templateOpeningHours())]);
    await pool.query('INSERT INTO seller_verified_phones(seller_id,phone_e164,verified_at) VALUES($1,$2,now()) ON CONFLICT DO NOTHING',[seller,'+77000000001']);
    await pool.query(`INSERT INTO offers(id,card_id,seller_id,location_id,title,title_search,price_amount,price_currency,price_unit_code,pack_amount,pack_unit,status,last_confirmed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'KZT',$8,$9,$10,'active',$11) ON CONFLICT(id) DO UPDATE SET last_confirmed_at=excluded.last_confirmed_at,title=excluded.title,title_search=excluded.title_search`,
      [offer,id(200+i),seller,point,row[0],offerTitleSearchText(row[0]),row[1],i===1||i===2?'package':'kg',i===1?'500':null,i===1?'g':null,new Date(Date.now()-row[5]*60000)]);
    if(row[7]) {
      const svg=await readFile(`tests/fixtures/design-search/${row[7]}.svg`);
      const image=await sharp(svg).resize(800,800).webp().toBuffer();
      await pool.query('INSERT INTO photos(id,owner_user_id,width,height) VALUES($1,$2,800,800) ON CONFLICT(id) DO NOTHING',[photo,owner]);
      const storage=createDiskPhotoStorage();
      await storage.write(photo,'thumb',image); await storage.write(photo,'display',image);
      await pool.query('INSERT INTO offer_photos(offer_id,photo_id,position) VALUES($1,$2,0) ON CONFLICT DO NOTHING',[offer,photo]);
    }
  }
  await pool.query('COMMIT');
  process.stdout.write('Prepared4 synthetic preview Offers; no production or test DB touched.\n');
} catch(error) { await pool.query('ROLLBACK'); throw error; }
finally { await pool.end(); }
