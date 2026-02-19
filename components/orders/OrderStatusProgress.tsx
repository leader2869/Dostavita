'use client'

interface OrderStatusProgressProps {
  status: string
  variant?: 'default' | 'connected' | 'minimal' | 'timeline'
}

export function OrderStatusProgress({ status, variant = 'connected' }: OrderStatusProgressProps) {
  // Определяем этапы заказа
  const stages = [
    { id: 1, label: 'Заказ создан', status: 'searching_courier' },
    { id: 2, label: 'Курьер принял', status: 'courier_accepted' },
    { id: 3, label: 'Едет к отправителю', status: 'courier_coming' },
    { id: 4, label: 'Едет к получателю', status: 'courier_delivering' },
    { id: 5, label: 'Завершен', status: 'completed' },
  ]

  // Определяем текущий этап
  const getCurrentStage = () => {
    if (status === 'cancelled') return 0
    const stageIndex = stages.findIndex(s => s.status === status)
    return stageIndex >= 0 ? stageIndex + 1 : 0
  }

  const currentStage = getCurrentStage()

  if (status === 'cancelled') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600 font-semibold">Заказ отменен</p>
      </div>
    )
  }

  // Вариант 1: Соединенная линия с кружочками - единый сосуд
  if (variant === 'connected') {
    return (
      <div className="w-full py-3 fixed top-16 left-0 right-0 bg-white z-30 border-b border-gray-200 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            {/* Фоновая линия - широкая, проходит через все кружки */}
            <div className="absolute top-6 left-0 right-0 h-2.5 bg-gray-200 rounded-full"></div>
            
            {/* Прогресс линия - широкая, заполняется зеленым */}
            <div
              className="absolute top-6 left-0 h-2.5 bg-green-500 rounded-full transition-all duration-500"
              style={{ 
                width: currentStage === 0 
                  ? '0%' 
                  : currentStage === stages.length
                  ? '100%'
                  : `${((currentStage - 1) / (stages.length - 1)) * 100 + (100 / (stages.length - 1)) * 0.5}%` 
              }}
            ></div>

            {/* Кружочки с этапами - часть единого сосуда */}
            <div className="relative flex justify-between">
              {stages.map((stage, index) => {
                const isActive = index + 1 <= currentStage
                const isCurrent = index + 1 === currentStage

                return (
                  <div key={stage.id} className="flex flex-col items-center">
                    {/* Круг этапа - единый, сливается с линией */}
                    <div
                      className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all z-10 ${
                        isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-2 ring-green-300' : ''}`}
                    >
                      {isActive ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-xs font-bold">{stage.id}</span>
                      )}
                    </div>
                    
                    {/* Подпись этапа */}
                    <p
                      className={`text-xs mt-1.5 text-center max-w-[75px] leading-tight ${
                        isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'
                      }`}
                    >
                      {stage.label}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Вариант 2: Минималистичный с тонкой линией
  if (variant === 'minimal') {
    return (
      <div className="w-full py-4">
        <div className="relative">
          {/* Фоновая линия */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200"></div>
          
          {/* Прогресс линия */}
          <div
            className="absolute top-4 left-0 h-0.5 bg-green-500 transition-all duration-500"
            style={{ width: `${((currentStage - 1) / (stages.length - 1)) * 100}%` }}
          ></div>

          {/* Кружочки */}
          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const isActive = index + 1 <= currentStage
              const isCurrent = index + 1 === currentStage

              return (
                <div key={stage.id} className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                      isActive
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    } ${isCurrent ? 'ring-2 ring-green-300' : ''}`}
                  >
                    {isActive ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs font-semibold">{stage.id}</span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-1.5 text-center max-w-[70px] ${
                      isActive ? 'text-gray-900 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Вариант 3: Timeline стиль с вертикальными линиями
  if (variant === 'timeline') {
    return (
      <div className="w-full py-4">
        <div className="relative">
          {/* Горизонтальная линия */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full"></div>
          
          {/* Прогресс */}
          <div
            className="absolute top-5 left-0 h-1 bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${((currentStage - 1) / (stages.length - 1)) * 100}%` }}
          ></div>

          {/* Этапы */}
          <div className="relative flex justify-between">
            {stages.map((stage, index) => {
              const isActive = index + 1 <= currentStage
              const isCurrent = index + 1 === currentStage

              return (
                <div key={stage.id} className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-3 transition-all z-10 ${
                      isActive
                        ? 'bg-green-500 border-green-500 text-white shadow-md'
                        : 'bg-white border-gray-300 text-gray-400'
                    } ${isCurrent ? 'ring-4 ring-green-200 animate-pulse' : ''}`}
                    style={{ borderWidth: '3px' }}
                  >
                    {isActive ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">{stage.id}</span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-2 text-center max-w-[85px] leading-tight ${
                      isActive ? 'text-gray-900 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Вариант по умолчанию (старый вариант с прогресс-баром)
  const progress = (currentStage / stages.length) * 100
  return (
    <div className="w-full">
      <div className="relative h-2 bg-gray-200 rounded-full mb-4">
        <div
          className="absolute left-0 top-0 h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="flex justify-between items-start">
        {stages.map((stage, index) => {
          const isActive = index + 1 <= currentStage
          const isCurrent = index + 1 === currentStage
          return (
            <div key={stage.id} className="flex-1 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-gray-200 border-gray-300 text-gray-400'
                } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}
              >
                {isActive ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-semibold">{stage.id}</span>
                )}
              </div>
              <p
                className={`text-xs mt-2 text-center max-w-[80px] ${
                  isActive ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}
              >
                {stage.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

