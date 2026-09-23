import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-300">404</p>
      <h1 className="mt-3 text-3xl font-semibold">This private page does not exist.</h1>
      <p className="mt-3 text-sm text-neutral-400">
        The slug may be wrong, or nobody has created this contact page yet.
      </p>
      <Link href="/" className="mt-8 inline-block rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
        Create a page
      </Link>
    </div>
  );
}
