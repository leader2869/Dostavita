import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID заказа не указан' },
        { status: 400 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем, что заказ существует и имеет статус searching_courier
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Заказ не найден' },
        { status: 404 }
      )
    }

    if (order.status !== 'searching_courier') {
      return NextResponse.json(
        { error: 'Заказ уже не доступен для принятия' },
        { status: 400 }
      )
    }

    // Создаем запись об отказе
    const { error: rejectionError } = await supabase
      .from('order_rejections')
      .insert({
        order_id: orderId,
        driver_user_id: user.id,
      })

    if (rejectionError) {
      // Если уже есть отказ, это нормально (UNIQUE constraint)
      if (rejectionError.code === '23505') {
        return NextResponse.json({ success: true, message: 'Заказ уже был отклонен' })
      }
      return NextResponse.json(
        { error: rejectionError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Заказ отклонен' })
  } catch (error: any) {
    console.error('Ошибка при отклонении заказа:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}



