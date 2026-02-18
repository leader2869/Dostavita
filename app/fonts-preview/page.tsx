'use client'

import { useEffect } from 'react'

export default function FontsPreviewPage() {
  useEffect(() => {
    // Загружаем Google Fonts
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Montserrat:wght@100;200;300;400;500;600;700;800;900&family=Poppins:wght@100;200;300;400;500;600;700;800;900&family=Open+Sans:wght@300;400;600;700;800&family=Raleway:wght@100;200;300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&family=Lora:wght@400;700&family=Merriweather:wght@300;400;700;900&family=Source+Sans+Pro:wght@200;300;400;600;700;900&family=Oswald:wght@200;300;400;500;600;700&family=Lato:wght@100;300;400;700;900&family=Ubuntu:wght@300;400;500;700&family=Nunito:wght@200;300;400;600;700;800;900&family=PT+Sans:wght@400;700&family=PT+Serif:wght@400;700&family=Crimson+Text:wght@400;600;700&family=Libre+Baskerville:wght@400;700&family=Playfair+Display+SC:wght@400;700;900&family=Cormorant+Garamond:wght@300;400;500;600;700&family=EB+Garamond:wght@400;500;600;700;800&family=Noto+Serif:wght@400;700&family=Noto+Sans:wght@400;700&family=Work+Sans:wght@100;200;300;400;500;600;700;800;900&family=Quicksand:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;700&family=Manrope:wght@200;300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&family=Outfit:wght@100;200;300;400;500;600;700;800;900&family=Josefin+Sans:wght@100;200;300;400;500;600;700&family=Comfortaa:wght@300;400;500;600;700&family=Kalam:wght@300;400;700&family=Pacifico&family=Caveat:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&family=Satisfy&family=Great+Vibes&family=Allura&family=Alex+Brush&family=Parisienne&family=Amatic+SC:wght@400;700&family=Indie+Flower&family=Shadows+Into+Light&family=Permanent+Marker&family=Fredoka+One&family=Bangers&family=Lobster&family=Lobster+Two:wght@400;700&family=Righteous&family=Creepster&family=Monoton&family=Orbitron:wght@400;500;600;700;800;900&family=Audiowide&family=Russo+One&family=Bebas+Neue&family=Anton&family=Black+Ops+One&family=Staatliches&family=Passion+One:wght@400;700;900&family=Fredoka:wght@300;400;500;600&family=Comic+Neue:wght@300;400;700&family=Knewave&family=Butcherman&family=Eater&family=Fascinate&family=Fascinate+Inline&family=Flavors&family=Frijole&family=Gravitas+One&family=Griffy&family=Henny+Penny&family=Irish+Grover&family=Kavoon&family=Knewave&family=Londrina+Shadow&family=Londrina+Solid:wght@100;300;400;900&family=Monofett&family=Nosifer&family=Nosifer+Caps&family=Offside&family=Oleo+Script:wght@400;700&family=Oleo+Script+Swash+Caps:wght@400;700&family=Original+Surfer&family=Plaster&family=Press+Start+2P&family=Prosto+One&family=Rubik+Beastly&family=Rubik+Glitch&family=Rubik+Microbe&family=Rubik+Mono+One&family=Rubik+Puddles&family=Rubik+Wet+Paint&family=Rubik+Bubbles&family=Sevillana&family=Shrikhand&family=Sigmar+One&family=Smokum&family=Stalinist+One&family=Stardos+Stencil:wght@400;700&family=UnifrakturCook:wght@700&family=UnifrakturMaguntia&family=Unlock&family=Vast+Shadow&family=Vibes&family=Wallpoet&family=Wendy+One&family=Zilla+Slab+Highlight:wght@400;700&family=Zilla+Slab:wght@300;400;500;600;700&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }, [])

  const fonts = [
    { name: 'Inter Bold', font: 'Inter', weight: 700, style: 'normal' },
    { name: 'Inter ExtraBold', font: 'Inter', weight: 800, style: 'normal' },
    { name: 'Inter Black', font: 'Inter', weight: 900, style: 'normal' },
    { name: 'Roboto Bold', font: 'Roboto', weight: 700, style: 'normal' },
    { name: 'Roboto Black', font: 'Roboto', weight: 900, style: 'normal' },
    { name: 'Montserrat Bold', font: 'Montserrat', weight: 700, style: 'normal' },
    { name: 'Montserrat ExtraBold', font: 'Montserrat', weight: 800, style: 'normal' },
    { name: 'Montserrat Black', font: 'Montserrat', weight: 900, style: 'normal' },
    { name: 'Poppins Bold', font: 'Poppins', weight: 700, style: 'normal' },
    { name: 'Poppins ExtraBold', font: 'Poppins', weight: 800, style: 'normal' },
    { name: 'Poppins Black', font: 'Poppins', weight: 900, style: 'normal' },
    { name: 'Raleway Bold', font: 'Raleway', weight: 700, style: 'normal' },
    { name: 'Raleway ExtraBold', font: 'Raleway', weight: 800, style: 'normal' },
    { name: 'Raleway Black', font: 'Raleway', weight: 900, style: 'normal' },
    { name: 'Playfair Display Bold', font: 'Playfair Display', weight: 700, style: 'normal' },
    { name: 'Playfair Display Black', font: 'Playfair Display', weight: 900, style: 'normal' },
    { name: 'Oswald Bold', font: 'Oswald', weight: 700, style: 'normal' },
    { name: 'Oswald Medium', font: 'Oswald', weight: 500, style: 'normal' },
    { name: 'Lato Black', font: 'Lato', weight: 900, style: 'normal' },
    { name: 'Lato Bold', font: 'Lato', weight: 700, style: 'normal' },
    { name: 'Nunito Bold', font: 'Nunito', weight: 700, style: 'normal' },
    { name: 'Nunito ExtraBold', font: 'Nunito', weight: 800, style: 'normal' },
    { name: 'Nunito Black', font: 'Nunito', weight: 900, style: 'normal' },
    { name: 'Work Sans Bold', font: 'Work Sans', weight: 700, style: 'normal' },
    { name: 'Work Sans ExtraBold', font: 'Work Sans', weight: 800, style: 'normal' },
    { name: 'Work Sans Black', font: 'Work Sans', weight: 900, style: 'normal' },
    { name: 'Quicksand Bold', font: 'Quicksand', weight: 700, style: 'normal' },
    { name: 'Rubik Bold', font: 'Rubik', weight: 700, style: 'normal' },
    { name: 'Rubik ExtraBold', font: 'Rubik', weight: 800, style: 'normal' },
    { name: 'Rubik Black', font: 'Rubik', weight: 900, style: 'normal' },
    { name: 'Space Grotesk Bold', font: 'Space Grotesk', weight: 700, style: 'normal' },
    { name: 'DM Sans Bold', font: 'DM Sans', weight: 700, style: 'normal' },
    { name: 'Manrope Bold', font: 'Manrope', weight: 700, style: 'normal' },
    { name: 'Manrope ExtraBold', font: 'Manrope', weight: 800, style: 'normal' },
    { name: 'Plus Jakarta Sans Bold', font: 'Plus Jakarta Sans', weight: 700, style: 'normal' },
    { name: 'Plus Jakarta Sans ExtraBold', font: 'Plus Jakarta Sans', weight: 800, style: 'normal' },
    { name: 'Outfit Bold', font: 'Outfit', weight: 700, style: 'normal' },
    { name: 'Outfit ExtraBold', font: 'Outfit', weight: 800, style: 'normal' },
    { name: 'Outfit Black', font: 'Outfit', weight: 900, style: 'normal' },
    { name: 'Josefin Sans Bold', font: 'Josefin Sans', weight: 700, style: 'normal' },
    { name: 'Comfortaa Bold', font: 'Comfortaa', weight: 700, style: 'normal' },
    { name: 'Pacifico', font: 'Pacifico', weight: 400, style: 'normal' },
    { name: 'Caveat Bold', font: 'Caveat', weight: 700, style: 'normal' },
    { name: 'Dancing Script Bold', font: 'Dancing Script', weight: 700, style: 'normal' },
    { name: 'Satisfy', font: 'Satisfy', weight: 400, style: 'normal' },
    { name: 'Great Vibes', font: 'Great Vibes', weight: 400, style: 'normal' },
    { name: 'Allura', font: 'Allura', weight: 400, style: 'normal' },
    { name: 'Alex Brush', font: 'Alex Brush', weight: 400, style: 'normal' },
    { name: 'Amatic SC Bold', font: 'Amatic SC', weight: 700, style: 'normal' },
    { name: 'Lobster', font: 'Lobster', weight: 400, style: 'normal' },
    { name: 'Righteous', font: 'Righteous', weight: 400, style: 'normal' },
    { name: 'Orbitron Bold', font: 'Orbitron', weight: 700, style: 'normal' },
    { name: 'Orbitron Black', font: 'Orbitron', weight: 900, style: 'normal' },
    { name: 'Russo One', font: 'Russo One', weight: 400, style: 'normal' },
    { name: 'Bebas Neue', font: 'Bebas Neue', weight: 400, style: 'normal' },
    { name: 'Anton', font: 'Anton', weight: 400, style: 'normal' },
    { name: 'Passion One Bold', font: 'Passion One', weight: 700, style: 'normal' },
    { name: 'Passion One Black', font: 'Passion One', weight: 900, style: 'normal' },
    { name: 'Fredoka Bold', font: 'Fredoka', weight: 600, style: 'normal' },
    { name: 'Londrina Solid', font: 'Londrina Solid', weight: 400, style: 'normal' },
    { name: 'Londrina Solid Black', font: 'Londrina Solid', weight: 900, style: 'normal' },
    { name: 'Oleo Script Bold', font: 'Oleo Script', weight: 700, style: 'normal' },
    { name: 'Prosto One', font: 'Prosto One', weight: 400, style: 'normal' },
    { name: 'Sigmar One', font: 'Sigmar One', weight: 400, style: 'normal' },
    { name: 'Stardos Stencil Bold', font: 'Stardos Stencil', weight: 700, style: 'normal' },
    { name: 'Zilla Slab Bold', font: 'Zilla Slab', weight: 700, style: 'normal' },
    { name: 'Zilla Slab Highlight Bold', font: 'Zilla Slab Highlight', weight: 700, style: 'normal' },
  ]

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          Варианты шрифтов для логотипа "Просто!"
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fonts.map((font, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="mb-2">
                <span className="text-xs text-gray-500 font-mono">{font.name}</span>
              </div>
              <div
                className="text-3xl mb-2"
                style={{
                  fontFamily: `"${font.font}", sans-serif`,
                  fontWeight: font.weight,
                  fontStyle: font.style,
                  color: '#87ceeb', // Светло-голубой цвет бренда
                }}
              >
                Просто!
              </div>
              <div
                className="text-lg"
                style={{
                  fontFamily: `"${font.font}", sans-serif`,
                  fontWeight: font.weight,
                  fontStyle: font.style,
                  color: '#000000',
                }}
              >
                Просто!
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Рекомендации</h2>
          <ul className="space-y-2 text-gray-700">
            <li>• <strong>Современные и минималистичные:</strong> Inter, Roboto, Montserrat, Poppins</li>
            <li>• <strong>Элегантные и классические:</strong> Playfair Display, Lora, Merriweather</li>
            <li>• <strong>Дружелюбные и округлые:</strong> Nunito, Quicksand, Comfortaa, Fredoka</li>
            <li>• <strong>Смелые и выразительные:</strong> Oswald, Bebas Neue, Anton, Russo One</li>
            <li>• <strong>Игривые и неформальные:</strong> Pacifico, Dancing Script, Caveat, Amatic SC</li>
            <li>• <strong>Технологичные и футуристичные:</strong> Orbitron, Space Grotesk, Rubik</li>
            <li>• <strong>Уникальные:</strong> Prosto One (идеально подходит по названию!), Londrina Solid</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

