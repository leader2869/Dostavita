import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    const orderId = params.id

    if (!orderId) {
      return NextResponse.json(
        { error: 'ID заказа обязателен' },
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

    // Получаем заказ и проверяем права
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, customer_id, client_id, executor_user_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Заказ не найден' },
        { status: 404 }
      )
    }

    // Проверяем, что заказ в статусе searching_courier
    if (order.status !== 'searching_courier') {
      return NextResponse.json(
        { error: 'Можно отменить только заказ в статусе "Ищем курьера"' },
        { status: 400 }
      )
    }

    // Проверяем, что заказ еще не принят водителем
    if (order.executor_user_id) {
      return NextResponse.json(
        { error: 'Заказ уже принят водителем, отмена невозможна' },
        { status: 400 }
      )
    }

    // Проверяем права: клиент может отменить свой заказ, организация - заказы своих водителей
    const { data: profile } = await supabase
      .rpc('get_user_profile', { user_id: user.id })
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Профиль не найден' },
        { status: 404 }
      )
    }

    const userRole = (profile as any).role

    // Проверяем права доступа
    let hasAccess = false
    if (userRole === 'client' && order.client_id === user.id) {
      hasAccess = true
    } else if (userRole === 'customer' && order.customer_id === user.id) {
      hasAccess = true
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Нет прав для отмены этого заказа' },
        { status: 403 }
      )
    }

    // Отменяем заказ
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Ошибка отмены заказа:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Заказ успешно отменен',
    })
  } catch (error: any) {
    console.error('Ошибка API:', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

