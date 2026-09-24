import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-accent">٤٠٤</p>
        <h1 className="mb-3 font-serif text-[30px] font-normal">الصفحة دي مش موجودة</h1>
        <Link href="/" className="text-accent underline-offset-4 hover:underline">رجوع للرئيسية</Link>
      </div>
    </main>
  );
}
