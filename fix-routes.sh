#!/bin/bash

# Lista de archivos a corregir
files=(
  "./app/api/raffles/by-slug/[slug]/route.ts"
  "./app/api/rifas/by-slug/[slug]/route.ts"
  "./api/raffles/[slug]/route.ts"
  "./app/api/tickets/[raffleId]/route.ts"
  "./app/api/raffles/[id]/route.ts"
  "./app/api/admin/reservations/voucher-url/[reservationId]/route.ts"
  "./app/api/admin/reservations/voucher-url/[reservationId]/[id]/route.ts"
  "./app/api/admin/reservations/[id]/confirm/reject/route.ts"
  "./app/api/admin/reservations/[id]/confirm/route.ts"
  "./app/api/admin/raffles/[id]/route.ts"
  "./app/api/admin/raffles/[id]/banner/route.ts"
  "./app/api/admin/raffles/[id]/media/route.ts"
  "./app/api/admin/voucher-url/[id]/route.ts"
  "./app/api/admin/orders/[id]/reject/route.ts"
  "./app/api/admin/orders/[id]/confirm/route.ts"
  "./app/api/rifas/[id]/edit/route.ts"
  "./app/api/rifas/[id]/route.ts"
)

echo "🔧 Corrigiendo archivos de rutas para Next.js 15..."

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Procesando: $file"
    # Crear backup
    cp "$file" "$file.backup"
    
    # Reemplazar patrones comunes
    sed -i '' 's/ctx: { params: { \([^}]*\) } }/{ params }: { params: Promise<{ \1 }> }/g' "$file"
    sed -i '' 's/context: { params: { \([^}]*\) } }/{ params }: { params: Promise<{ \1 }> }/g' "$file"
    sed -i '' 's/const \([a-zA-Z]*\) = ctx\.params\?\.\([a-zA-Z]*\)/const { \2 } = await params/g' "$file"
    sed -i '' 's/const \([a-zA-Z]*\) = context\.params\?\.\([a-zA-Z]*\)/const { \2 } = await params/g' "$file"
    
    echo "✅ Corregido: $file"
  else
    echo "⚠️  No existe: $file"
  fi
done

echo "✨ ¡Corrección completada!"
echo "📝 Se crearon backups con extensión .backup"
