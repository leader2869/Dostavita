'use client'

import { useState } from 'react'

export default function IconSelectorPage() {
  const [selectedIcon, setSelectedIcon] = useState<number | null>(null)

  const carIcons = [
    {
      id: 1,
      name: 'Машинка 1 (простая)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V9a2 2 0 012-2h10a2 2 0 012 2v4M5 13h14" />
        </svg>
      ),
    },
    {
      id: 2,
      name: 'Машинка 2 (с окнами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M9 10h6" />
        </svg>
      ),
    },
    {
      id: 3,
      name: 'Машинка 3 (боковая)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 12v4a2 2 0 002 2h14a2 2 0 002-2v-4M3 12V8a2 2 0 012-2h14a2 2 0 012 2v4M7 8v8M17 8v8M9 10h6" />
        </svg>
      ),
    },
    {
      id: 4,
      name: 'Машинка 4 (грузовик)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h8a2 2 0 012 2v5M5 13h14M9 10h4" />
        </svg>
      ),
    },
    {
      id: 5,
      name: 'Машинка 5 (спортивная)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V7a2 2 0 012-2h10a2 2 0 012 2v6M5 13h14M8 9h8" />
        </svg>
      ),
    },
    {
      id: 6,
      name: 'Машинка 6 (кузов)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 12v3a2 2 0 002 2h14a2 2 0 002-2v-3M3 12V9a2 2 0 012-2h14a2 2 0 012 2v3M7 9v6M17 9v6M9 11h6" />
        </svg>
      ),
    },
    {
      id: 7,
      name: 'Машинка 7 (с крышей)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 11h8" />
        </svg>
      ),
    },
    {
      id: 8,
      name: 'Машинка 8 (мини)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM6 12V9a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 9v3M6 12h12" />
        </svg>
      ),
    },
    {
      id: 9,
      name: 'Машинка 9 (автобус)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V7a2 2 0 012-2h10a2 2 0 012 2v6M5 13h14M7 9h10M7 11h10" />
        </svg>
      ),
    },
    {
      id: 10,
      name: 'Машинка 10 (кабриолет)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14" />
        </svg>
      ),
    },
    {
      id: 11,
      name: 'Машинка 11 (классическая)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12v4a2 2 0 002 2h12a2 2 0 002-2v-4M4 12V8a2 2 0 012-2h12a2 2 0 012 2v4M8 8v8M16 8v8M6 10h12" />
        </svg>
      ),
    },
    {
      id: 12,
      name: 'Машинка 12 (с багажником)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h8a2 2 0 012 2v5M5 13h14M9 10h4M13 10h4" />
        </svg>
      ),
    },
    {
      id: 13,
      name: 'Машинка 13 (хэтчбек)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V7a2 2 0 012-2h10a2 2 0 012 2v6M5 13h14M8 9h8M8 11h8" />
        </svg>
      ),
    },
    {
      id: 14,
      name: 'Машинка 14 (седан)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M7 9h10M7 11h10" />
        </svg>
      ),
    },
    {
      id: 15,
      name: 'Машинка 15 (внедорожник)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 14a2 2 0 100-4 2 2 0 000 4zM19 14a2 2 0 100-4 2 2 0 000 4zM5 14V8a2 2 0 012-2h10a2 2 0 012 2v6M5 14h14M8 10h8M8 12h8" />
        </svg>
      ),
    },
    {
      id: 16,
      name: 'Машинка 16 (купе)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V7a2 2 0 012-2h10a2 2 0 012 2v6M5 13h14M9 9h6" />
        </svg>
      ),
    },
    {
      id: 17,
      name: 'Машинка 17 (фургон)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M7 9h10" />
        </svg>
      ),
    },
    {
      id: 18,
      name: 'Машинка 18 (пикап)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h8a2 2 0 012 2v5M5 13h14M9 10h4" />
        </svg>
      ),
    },
    {
      id: 19,
      name: 'Машинка 19 (лимузин)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h14a2 2 0 012 2v5M5 13h14M7 9h10M7 11h10" />
        </svg>
      ),
    },
    {
      id: 20,
      name: 'Машинка 20 (компактная)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM6 12V9a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0118 9v3M6 12h12" />
        </svg>
      ),
    },
    {
      id: 21,
      name: 'Машинка 21 (горизонтальная)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 12v3a2 2 0 002 2h14a2 2 0 002-2v-3M3 12V9a2 2 0 012-2h14a2 2 0 012 2v3M7 9v6M17 9v6M9 11h6" />
        </svg>
      ),
    },
    {
      id: 22,
      name: 'Машинка 22 (с дверями)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M7 11h2M15 11h2" />
        </svg>
      ),
    },
    {
      id: 23,
      name: 'Машинка 23 (с решеткой)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 10h8" />
        </svg>
      ),
    },
    {
      id: 24,
      name: 'Машинка 24 (с фарами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M6 9h2M16 9h2M8 11h8" />
        </svg>
      ),
    },
    {
      id: 25,
      name: 'Машинка 25 (с антенной)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M12 7v2" />
        </svg>
      ),
    },
    {
      id: 26,
      name: 'Машинка 26 (с зеркалами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M4 10h1M19 10h1" />
        </svg>
      ),
    },
    {
      id: 27,
      name: 'Машинка 27 (с багажником на крыше)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 7h8" />
        </svg>
      ),
    },
    {
      id: 28,
      name: 'Машинка 28 (с спойлером)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 15h8" />
        </svg>
      ),
    },
    {
      id: 29,
      name: 'Машинка 29 (с номером)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M10 11h4" />
        </svg>
      ),
    },
    {
      id: 30,
      name: 'Машинка 30 (с выхлопом)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M5 15h2" />
        </svg>
      ),
    },
    {
      id: 31,
      name: 'Машинка 31 (с крышей)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 7h8M8 11h8" />
        </svg>
      ),
    },
    {
      id: 32,
      name: 'Машинка 32 (с дверными ручками)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M7 10h1M16 10h1" />
        </svg>
      ),
    },
    {
      id: 33,
      name: 'Машинка 33 (с решеткой радиатора)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 8h8" />
        </svg>
      ),
    },
    {
      id: 34,
      name: 'Машинка 34 (с бампером)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M5 16h14" />
        </svg>
      ),
    },
    {
      id: 35,
      name: 'Машинка 35 (с задним стеклом)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 11h8M8 7h8" />
        </svg>
      ),
    },
    {
      id: 36,
      name: 'Машинка 36 (с боковыми окнами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M4 10h1M19 10h1" />
        </svg>
      ),
    },
    {
      id: 37,
      name: 'Машинка 37 (с передним бампером)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M5 7h14" />
        </svg>
      ),
    },
    {
      id: 38,
      name: 'Машинка 38 (с задним бампером)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M5 15h14" />
        </svg>
      ),
    },
    {
      id: 39,
      name: 'Машинка 39 (с крышей и окнами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 7h8M8 11h8" />
        </svg>
      ),
    },
    {
      id: 40,
      name: 'Машинка 40 (с боковыми линиями)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M4 10h1M19 10h1M4 12h1M19 12h1" />
        </svg>
      ),
    },
    {
      id: 41,
      name: 'Машинка 41 (с декоративными элементами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M6 10h2M16 10h2" />
        </svg>
      ),
    },
    {
      id: 42,
      name: 'Машинка 42 (с боковыми панелями)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M3 10h2M19 10h2" />
        </svg>
      ),
    },
    {
      id: 43,
      name: 'Машинка 43 (с рейлингами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M7 7h10" />
        </svg>
      ),
    },
    {
      id: 44,
      name: 'Машинка 44 (с боковыми молдингами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M3 11h2M19 11h2" />
        </svg>
      ),
    },
    {
      id: 45,
      name: 'Машинка 45 (с задними фарами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M5 15h2M17 15h2" />
        </svg>
      ),
    },
    {
      id: 46,
      name: 'Машинка 46 (с передними фарами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M5 7h2M17 7h2" />
        </svg>
      ),
    },
    {
      id: 47,
      name: 'Машинка 47 (с боковыми зеркалами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M2 10h2M20 10h2" />
        </svg>
      ),
    },
    {
      id: 48,
      name: 'Машинка 48 (с дефлекторами)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 8h8" />
        </svg>
      ),
    },
    {
      id: 49,
      name: 'Машинка 49 (с боковыми наклейками)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M3 11h1M20 11h1" />
        </svg>
      ),
    },
    {
      id: 50,
      name: 'Машинка 50 (полная детализация)',
      svg: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13a2 2 0 100-4 2 2 0 000 4zM19 13a2 2 0 100-4 2 2 0 000 4zM5 13V8a2 2 0 012-2h10a2 2 0 012 2v5M5 13h14M8 9h8M8 7h8M8 11h8M5 7h2M17 7h2M5 15h2M17 15h2" />
        </svg>
      ),
    },
  ]

  const handleSelect = (id: number) => {
    setSelectedIcon(id)
    const icon = carIcons.find(i => i.id === id)
    if (icon) {
      console.log('Выбрана иконка:', icon.name)
      console.log('SVG код:', icon.svg)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Выбор иконки машинки</h1>
        
        {selectedIcon && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Выбрана иконка #{selectedIcon}: {carIcons.find(i => i.id === selectedIcon)?.name}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
          {carIcons.map((icon) => (
            <button
              key={icon.id}
              onClick={() => handleSelect(icon.id)}
              className={`p-4 bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all border-2 ${
                selectedIcon === icon.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className={`${selectedIcon === icon.id ? 'text-green-500' : 'text-gray-300'}`}>
                  {icon.svg}
                </div>
                <span className="text-xs text-center text-gray-300">
                  #{icon.id}
                </span>
              </div>
            </button>
          ))}
        </div>

        {selectedIcon && (
          <div className="mt-8 p-6 bg-gray-800 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              Выбранная иконка: {carIcons.find(i => i.id === selectedIcon)?.name}
            </h2>
            <div className="bg-gray-100 p-4 rounded">
              <pre className="text-xs overflow-x-auto">
                {JSON.stringify(carIcons.find(i => i.id === selectedIcon)?.svg, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

