export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      {/* Окружности - большие (анимированные) */}
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-slow"></div>
      <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-to-form"></div>

      {/* Окружности - средние (анимированные, заходят на форму) */}
      <div className="absolute top-40 right-1/4 w-32 h-32 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-to-form-reverse"></div>
      <div className="absolute bottom-40 left-1/3 w-40 h-40 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute top-1/3 right-20 w-36 h-36 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-slow"></div>

      {/* Окружности - маленькие (анимированные) */}
      <div className="absolute top-60 right-1/3 w-24 h-24 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-to-form"></div>
      <div className="absolute bottom-60 left-1/4 w-20 h-20 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float"></div>
      <div className="absolute top-1/4 right-1/3 w-28 h-28 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-slow"></div>
      <div className="absolute bottom-1/3 left-20 w-16 h-16 rounded-full border-4 border-brand-light opacity-10 pointer-events-none animate-float-to-form-reverse"></div>

      {/* Залитые окружности (пузыри) - анимированные, заходят на форму, с градиентами */}
      <div className="absolute top-32 right-32 w-8 h-8 rounded-full pointer-events-none animate-float-to-form" style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.15) 0%, rgba(135,206,235,0.05) 100%)' }}></div>
      <div className="absolute bottom-32 left-32 w-10 h-10 rounded-full pointer-events-none animate-float" style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.2) 0%, rgba(135,206,235,0.05) 100%)' }}></div>
      <div className="absolute top-1/2 right-1/3 w-6 h-6 rounded-full pointer-events-none animate-float-to-form-reverse" style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.18) 0%, rgba(135,206,235,0.03) 100%)' }}></div>
      <div className="absolute bottom-1/4 left-1/2 w-9 h-9 rounded-full pointer-events-none animate-float-slow" style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.16) 0%, rgba(135,206,235,0.04) 100%)' }}></div>
      <div className="absolute top-1/3 left-1/5 w-6 h-6 rounded-full pointer-events-none animate-float-to-form" style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.14) 0%, rgba(135,206,235,0.02) 100%)' }}></div>
      <div className="absolute bottom-1/2 right-1/5 w-8 h-8 rounded-full pointer-events-none animate-float" style={{ background: 'radial-gradient(circle, rgba(135,206,235,0.17) 0%, rgba(135,206,235,0.05) 100%)' }}></div>
      
      {/* Дополнительные круги, которые точно заходят на форму */}
      <div className="absolute top-1/2 left-1/2 w-20 h-20 rounded-full border-4 border-brand-light opacity-8 pointer-events-none animate-float-to-form" style={{ transform: 'translate(-50%, -50%)' }}></div>
      <div className="absolute top-1/2 left-1/2 w-10 h-10 rounded-full pointer-events-none animate-float-to-form-reverse" style={{ transform: 'translate(-50%, -50%)', background: 'radial-gradient(circle, rgba(135,206,235,0.2) 0%, rgba(135,206,235,0.06) 100%)' }}></div>
      <div className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full border-4 border-brand-light opacity-7 pointer-events-none animate-float-slow" style={{ transform: 'translate(-50%, -50%)' }}></div>

      {/* Контент */}
      <div className="relative z-10 max-w-md w-full space-y-8 p-8">
        {children}
      </div>
    </div>
  )
}

