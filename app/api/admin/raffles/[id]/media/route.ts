import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET - Cargar media
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: raffle, error: raffleError } = await supabase
      .from('raffles')
      .select(`
        *,
        bank_institutions (
          id,
          method,
          name,
          account,
          holder,
          logo_url,
          extra,
          order
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (raffleError || !raffle) {
      return NextResponse.json(
        { ok: false, error: 'Rifa no encontrada' },
        { status: 404 }
      );
    }

    const { data: mediaItems } = await supabase
      .from('raffle_media')
      .select('id, type, url, order')
      .eq('raffle_id', id)
      .order('order', { ascending: true });

    const gallery = (mediaItems || []).map(item => ({
      id: item.id,
      type: item.type as 'image' | 'video',
      url: item.url,
      order: item.order ?? 0
    }));

    return NextResponse.json({
      ok: true,
      raffle: {
        ...raffle,
        media: {
          banner: raffle.banner_url,
          gallery,
          logos: null
        }
      }
    });

  } catch (error: any) {
    console.error('Error en GET media:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno', details: error?.message },
      { status: 500 }
    );
  }
}

// POST - Subir archivos
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log('📤 POST /api/admin/raffles/[id]/media - Subiendo archivos');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: 'No se enviaron archivos' }, { status: 400 });
    }

    console.log(`📦 Procesando ${files.length} archivo(s)...`);

    const uploadedItems: any[] = [];

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `raffles/${id}/${fileName}`;

        console.log(`⬆️ Subiendo: ${fileName}`);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const { data, error } = await supabase.storage
          .from('raffles')
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false
          });

        if (error) {
          console.error(`❌ Error subiendo ${fileName}:`, error);
          continue;
        }

        console.log(`✅ Archivo subido: ${data.path}`);

        const { data: { publicUrl } } = supabase.storage
          .from('raffles')
          .getPublicUrl(filePath);

        const type = file.type.startsWith('video/') ? 'video' : 'image';

        uploadedItems.push({
          id: `media_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type,
          url: publicUrl,
          order: uploadedItems.length
        });

        console.log(`✅ URL pública: ${publicUrl}`);

      } catch (fileError) {
        console.error(`❌ Error procesando archivo:`, fileError);
      }
    }

    if (uploadedItems.length === 0) {
      console.error('❌ No se pudo subir ningún archivo');
      return NextResponse.json({ 
        ok: false, 
        error: 'No se pudo subir ningún archivo. Verifica los permisos de Storage.' 
      }, { status: 500 });
    }

    console.log(`✅ Subidos ${uploadedItems.length} archivo(s) exitosamente`);

    return NextResponse.json({ 
      ok: true, 
      gallery: uploadedItems 
    });

  } catch (error: any) {
    console.error('❌ Error crítico en POST media:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Error interno', 
      details: error?.message 
    }, { status: 500 });
  }
}

// PATCH - Actualizar galería
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    console.log('📝 PATCH /api/admin/raffles/[id]/media - ID:', id);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    console.log('📦 Body recibido en media PATCH:', body);

    const { gallery } = body;

    // Actualiza la galería si viene
    if (Array.isArray(gallery)) {
      console.log(`🔄 Actualizando galería con ${gallery.length} items`);
      
      // Elimina items existentes
      const { error: deleteError } = await supabase
        .from('raffle_media')
        .delete()
        .eq('raffle_id', id);

      if (deleteError) {
        console.error('❌ Error eliminando galería anterior:', deleteError);
      }

      // Inserta los nuevos
      if (gallery.length > 0) {
        const { error: insertError } = await supabase
          .from('raffle_media')
          .insert(
            gallery.map(item => ({
              id: item.id,
              raffle_id: id,
              type: item.type,
              url: item.url,
              order: item.order ?? 0
            }))
          );

        if (insertError) {
          console.error('❌ Error insertando galería:', insertError);
          return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
        }
      }

      console.log('✅ Galería actualizada');
    }

    console.log('✅ Media actualizada exitosamente');

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('❌ Error en PATCH media:', error);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}