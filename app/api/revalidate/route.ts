import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { ok: false, error: 'Path requerido' }, 
        { status: 400 }
      );
    }

    console.log('🔄 Revalidando path:', path);
    revalidatePath(path);
    console.log('✅ Cache revalidado exitosamente para:', path);

    return NextResponse.json({ 
      ok: true, 
      revalidated: true, 
      path,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Error revalidando cache:', error);
    return NextResponse.json(
      { ok: false, error: error.message }, 
      { status: 500 }
    );
  }
}