import { useState } from 'react';
import { Attribute, ATTRIBUTES, ATTRIBUTE_COLORS, OpponentView } from '@psylent/shared';

interface ResonateModalProps {
  target: OpponentView;
  myEnergy: number;
  onConfirm: (guess: [Attribute, Attribute]) => void;
  onCancel: () => void;
}

export function ResonateModal({ target, myEnergy, onConfirm, onCancel }: ResonateModalProps) {
  const knownAttrs: Attribute[] = target.attributes ?? [];
  const [selected, setSelected] = useState<Attribute[]>([]);

  const totalSelected = knownAttrs.length + selected.length;
  const canConfirm = totalSelected === 2 && myEnergy >= 3;

  const toggleAttr = (attr: Attribute) => {
    if (knownAttrs.includes(attr)) return; // already known, not selectable
    setSelected(prev =>
      prev.includes(attr)
        ? prev.filter(a => a !== attr)
        : prev.length + knownAttrs.length < 2
        ? [...prev, attr]
        : prev
    );
  };

  const handleConfirm = () => {
    const guess = [...knownAttrs, ...selected] as [Attribute, Attribute];
    onConfirm(guess);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-sm border border-purple-500 shadow-lg shadow-purple-500/30">
        <h2 className="text-xl font-bold text-center mb-1">共鸣指环</h2>
        <p className="text-center text-gray-400 text-sm mb-4">
          对 <span className="text-white font-semibold">{target.name}</span> 使用 ·
          消耗 3 能量（当前: {myEnergy}）
        </p>

        {knownAttrs.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">已知属性</div>
            <div className="flex gap-2">
              {knownAttrs.map(attr => (
                <span
                  key={attr}
                  className="px-3 py-1 rounded text-xs font-bold opacity-60 cursor-not-allowed"
                  style={{ backgroundColor: ATTRIBUTE_COLORS[attr].primary, color: '#000' }}
                >
                  {attr}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-xs text-gray-400 mb-2">
            猜测未知属性（还需选 {2 - totalSelected} 个）
          </div>
          <div className="grid grid-cols-3 gap-2">
            {ATTRIBUTES.map(attr => {
              const isKnown = knownAttrs.includes(attr);
              const isSelected = selected.includes(attr);
              return (
                <button
                  key={attr}
                  onClick={() => toggleAttr(attr)}
                  disabled={isKnown}
                  className={`
                    px-2 py-2 rounded text-xs font-bold transition-all
                    ${isKnown ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                    ${isSelected ? 'ring-2 ring-white scale-105' : ''}
                  `}
                  style={{
                    backgroundColor: ATTRIBUTE_COLORS[attr].primary,
                    color: '#000',
                  }}
                >
                  {attr}
                  {isSelected && <span className="ml-1">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded font-bold transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-bold transition-colors"
          >
            确认猜测
          </button>
        </div>

        {myEnergy < 3 && (
          <p className="text-center text-red-400 text-xs mt-2">能量不足（需要 3 点）</p>
        )}
      </div>
    </div>
  );
}
