export default function Loading() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 bg-gradient-to-b from-[#f4f7f4] to-[#fdf8f2]">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-sage-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sage-500 animate-spin" />
      </div>
      <p className="text-sage-400 text-xs tracking-wide">טוען את חדר הטיפולים…</p>
    </div>
  );
}
