export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      {/* Декоративные полосы - диагональные */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            #87ceeb,
            #87ceeb 30px,
            transparent 30px,
            transparent 60px
          )`
        }}></div>
      </div>

      {/* Декоративные полосы - вертикальные */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            #87ceeb,
            #87ceeb 40px,
            transparent 40px,
            transparent 80px
          )`
        }}></div>
      </div>

      {/* Декоративные полосы - горизонтальные */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            #87ceeb,
            #87ceeb 40px,
            transparent 40px,
            transparent 80px
          )`
        }}></div>
      </div>

      {/* Окружности - большие (анимированные) */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-slow"></div>
      <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-to-form"></div>

      {/* Окружности - средние (анимированные, заходят на форму) */}
      <div className="absolute top-40 right-1/4 w-32 h-32 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-to-form-reverse"></div>
      <div className="absolute bottom-40 left-1/3 w-40 h-40 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute top-1/3 right-20 w-36 h-36 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-slow"></div>

      {/* Окружности - маленькие (анимированные) */}
      <div className="absolute top-60 right-1/3 w-24 h-24 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-to-form"></div>
      <div className="absolute bottom-60 left-1/4 w-20 h-20 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute top-1/4 right-1/3 w-28 h-28 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-slow"></div>
      <div className="absolute bottom-1/3 left-20 w-16 h-16 rounded-full border-2 border-brand-light opacity-10 pointer-events-none animate-float-to-form-reverse"></div>

      {/* Залитые окружности (круги) - анимированные, заходят на форму */}
      <div className="absolute top-32 right-32 w-12 h-12 rounded-full bg-brand-light opacity-5 pointer-events-none animate-float-to-form"></div>
      <div className="absolute bottom-32 left-32 w-16 h-16 rounded-full bg-brand-light opacity-5 pointer-events-none animate-float"></div>
      <div className="absolute top-1/2 right-1/3 w-10 h-10 rounded-full bg-brand-light opacity-5 pointer-events-none animate-float-to-form-reverse"></div>
      <div className="absolute bottom-1/4 left-1/2 w-14 h-14 rounded-full bg-brand-light opacity-5 pointer-events-none animate-float-slow"></div>
      <div className="absolute top-1/3 left-1/5 w-8 h-8 rounded-full bg-brand-light opacity-5 pointer-events-none animate-float-to-form"></div>
      <div className="absolute bottom-1/2 right-1/5 w-12 h-12 rounded-full bg-brand-light opacity-5 pointer-events-none animate-float"></div>
      
      {/* Дополнительные круги, которые точно заходят на форму */}
      <div className="absolute top-1/2 left-1/2 w-20 h-20 rounded-full border-2 border-brand-light opacity-8 pointer-events-none animate-float-to-form" style={{ transform: 'translate(-50%, -50%)' }}></div>
      <div className="absolute top-1/2 left-1/2 w-16 h-16 rounded-full bg-brand-light opacity-6 pointer-events-none animate-float-to-form-reverse" style={{ transform: 'translate(-50%, -50%)' }}></div>
      <div className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full border-2 border-brand-light opacity-7 pointer-events-none animate-float-slow" style={{ transform: 'translate(-50%, -50%)' }}></div>

      {/* Контент */}
      <div className="relative z-10 max-w-md w-full space-y-8 p-8">
        {children}
      </div>
    </div>
  )
}

