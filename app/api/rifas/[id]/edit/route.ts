import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id } = params;
    
    console.log('📝 Intentando actualizar rifa:', id);

    // Verifica autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ No autenticado');
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Lee el body
    const body = await request.json();
    console.log('📦 Datos recibidos:', body);

    const { 
      title, 
      description, 
      price, 
      total_tickets, 
      banner_url,
      slug 
    } = body;

    // Construye el objeto de actualización
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (total_tickets !== undefined) updateData.total_tickets = total_tickets;
    if (banner_url !== undefined) updateData.banner_url = banner_url;
    if (slug !== undefined) updateData.slug = slug;

    console.log('🔄 Actualizando con:', updateData);

    // Actualiza la rifa
    const { data: raffle, error } = await supabase
      .from('raffles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error actualizando rifa:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    console.log('✅ Rifa actualizada exitosamente:', raffle);

    return NextResponse.json({ ok: true, raffle });

  } catch (error) {
    console.error('❌ Error en PATCH /api/admin/rifas/[id]/edit:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// También soporta POST
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return PATCH(request, { params });
}

// Maneja OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}