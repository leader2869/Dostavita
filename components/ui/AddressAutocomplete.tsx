'use client'

import { useState, useEffect, useRef } from 'react'

interface AddressResult {
  display_name: string
  lat: number
  lon: number
  address: any
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, coordinates?: { lat: number; lon: number }, addressDetails?: any) => void
  placeholder?: string
  className?: string
  required?: boolean
  id?: string
  filterByRegion?: string | null // Название региона для фильтрации результатов
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Введите адрес',
  className = '',
  required = false,
  id,
  filterByRegion = null,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<AddressResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Закрываем результаты при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Синхронизируем локальное состояние с внешним значением
  useEffect(() => {
    setQuery(value)
  }, [value])

  const searchAddress = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setResults([])
      setShowResults(false)
      return
    }

    setLoading(true)
    try {
      // Если указан фильтр по региону, добавляем его к запросу
      let query = searchQuery
      if (filterByRegion) {
        query = `${searchQuery}, ${filterByRegion}`
      }
      
      const response = await fetch(`/api/nominatim/search?q=${encodeURIComponent(query)}`)
      
      if (!response.ok) {
        throw new Error('Ошибка поиска адреса')
      }

      const data = await response.json()
      let results = data.results || []
      
      // Дополнительная фильтрация по региону, если указан
      if (filterByRegion) {
        const regionLower = filterByRegion.toLowerCase()
        results = results.filter((result: AddressResult) => {
          const address = result.address || {}
          const state = (address.state || '').toLowerCase()
          const displayName = (result.display_name || '').toLowerCase()
          
          // Проверяем, содержит ли адрес указанный регион
          return state.includes(regionLower) || displayName.includes(regionLower)
        })
      }
      
      setResults(results)
      setShowResults(true)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('Ошибка поиска адреса:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    onChange(newValue)

    // Очищаем предыдущий таймер
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Устанавливаем новый таймер для debounce
    debounceTimerRef.current = setTimeout(() => {
      searchAddress(newValue)
    }, 500) // Задержка 500мс
  }

  const handleSelectAddress = (result: AddressResult) => {
    setQuery(result.display_name)
    setShowResults(false)
    onChange(result.display_name, { lat: result.lat, lon: result.lon }, result.address)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectAddress(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        break
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true)
            }
          }}
          required={required}
          className={className}
          placeholder={placeholder}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg
              className="animate-spin h-5 w-5 text-gray-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.lat}-${result.lon}-${index}`}
              type="button"
              onClick={() => handleSelectAddress(result)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition ${
                index === selectedIndex ? 'bg-gray-100' : ''
              } ${index !== results.length - 1 ? 'border-b border-gray-200' : ''}`}
            >
              <p className="text-gray-900 text-sm font-medium">{result.display_name}</p>
              {result.address.city && (
                <p className="text-gray-600 text-xs mt-1">
                  {result.address.city}
                  {result.address.road && `, ${result.address.road}`}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

