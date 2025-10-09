// components/TicketGrid.tsx
"use client";
import { useEffect, useState } from "react";

type Props = {
  raffleId: string;
  quantity: number;
  price: number;
  onChange: (numbers: number[][]) => void;
};

export default function TicketGrid({ raffleId, quantity, price, onChange }: Props) {
  const [availableNumbers, setAvailableNumbers] = useState<number[]>([]);
  const [blocks, setBlocks] = useState<number[][]>([]);

  useEffect(() => {
    async function fetchAvailableNumbers() {
      const res = await fetch(`/api/tickets/${raffleId}`);
      const data = await res.json();
      setAvailableNumbers(data.numbers);
    }
    fetchAvailableNumbers();
  }, [raffleId]);

  useEffect(() => {
    if (availableNumbers.length < quantity * 4) return;

    const selectedBlocks: number[][] = [];

    const pool = [...availableNumbers];
    for (let i = 0; i < quantity; i++) {
      const block: number[] = [];
      while (block.length < 4 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        block.push(pool[idx]);
        pool.splice(idx, 1);
      }
      selectedBlocks.push(block);
    }

    setBlocks(selectedBlocks);
    onChange(selectedBlocks);
  }, [quantity, availableNumbers]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {blocks.map((block, i) => (
        <div
          key={i}
          className="bg-white border shadow rounded-lg p-4 text-center relative"
        >
          <div className="text-sm font-semibold text-gray-700 mb-2">
            🎟️ Boleto #{i + 1}
          </div>
          <div className="bg-yellow-100 p-2 rounded text-xs text-yellow-800">
            Esperando confirmación de pago. Tus números se mostrarán cuando el pago sea confirmado por el administrador.
          </div>
        </div>
      ))}
    </div>
  );
}
