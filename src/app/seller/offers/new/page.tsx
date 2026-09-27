import { redirect } from 'next/navigation';

// Old «Добавить товар» address: the empty card editor over «Моя витрина».
export default async function Page() {
  redirect('/seller?new=1');
}
