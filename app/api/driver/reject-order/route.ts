import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { rejectOrderSchema } from '@/lib/api/validate'

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const bodyResult = await parseBody(request, rejectOrderSchema)
    if (!bodyResult.ok) return bodyResult.response
    const { orderId } = bodyResult.data

    const auth = await requireRole(supabase, 'driver')
    if (!auth.ok) return auth.response
    const { user } = auth

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






