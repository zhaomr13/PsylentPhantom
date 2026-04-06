import { useState } from 'react';
import { ATTRIBUTES, Attribute, ATTRIBUTE_COLORS } from '@psylent/shared';

interface AttributeSelectorProps {
  onSelect: (attributes: [Attribute, Attribute]) => void;
  disabled?: boolean;
  options?: Attribute[]; // 玩家被分配的3张属性牌
}

export function AttributeSelector({ onSelect, disabled, options }: AttributeSelectorProps) {
  const [selected, setSelected] = useState<Attribute[]>([]);

  // 如果没有提供选项，使用所有属性（向后兼容）
  const availableAttributes = options ?? ATTRIBUTES;

  const handleAttributeClick = (attr: Attribute) => {
    if (disabled) return;

    if (selected.includes(attr)) {
      // Deselect if already selected
      setSelected(selected.filter(a => a !== attr));
    } else if (selected.length < 2) {
      // Select if less than 2 selected
      const newSelected = [...selected, attr];
      setSelected(newSelected);

      // Auto-submit if 2 attributes selected
      if (newSelected.length === 2) {
        onSelect([newSelected[0], newSelected[1]]);
      }
    }
  };

  const handleConfirm = () => {
    if (selected.length === 2) {
      onSelect([selected[0], selected[1]]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8 bg-gray-900/90 rounded-2xl border-2 border-gray-700">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 pixel-font">选择你的属性</h2>
        <p className="text-gray-400">系统已为你分配3张属性牌，请选择其中2张作为你的隐藏身份</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {availableAttributes.map((attr) => {
          const isSelected = selected.includes(attr);
          const colors = ATTRIBUTE_COLORS[attr];

          return (
            <button
              key={attr}
              onClick={() => handleAttributeClick(attr)}
              disabled={disabled || (!isSelected && selected.length >= 2)}
              className={`
                relative w-32 h-32 rounded-xl border-4 transition-all duration-200
                flex flex-col items-center justify-center gap-2
                ${isSelected
                  ? 'scale-110 shadow-lg'
                  : 'opacity-70 hover:opacity-100 hover:scale-105'
                }
                ${disabled || (!isSelected && selected.length >= 2)
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer'
                }
              `}
              style={{
                backgroundColor: colors.primary,
                borderColor: isSelected ? colors.secondary : 'transparent',
                color: '#000',
              }}
            >
              <span className="text-3xl font-bold">{attr[0]}</span>
              <span className="text-xs font-bold text-center px-2">{attr}</span>

              {isSelected && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                  ✓
                </div>
              )}

              {isSelected && (
                <div className="absolute -bottom-1 text-xs font-bold text-black/60">
                  #{selected.indexOf(attr) + 1}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {selected.length === 0 && (
            <span className="text-gray-500">请选择第一个属性</span>
          )}
          {selected.length === 1 && (
            <span className="text-yellow-400">请选择第二个属性</span>
          )}
          {selected.length === 2 && (
            <span className="text-green-400">已选择完成！</span>
          )}
        </div>

        {selected.length === 2 && (
          <button
            onClick={handleConfirm}
            disabled={disabled}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-bold transition-colors"
          >
            确认选择
          </button>
        )}

        {selected.length > 0 && (
          <button
            onClick={() => setSelected([])}
            disabled={disabled}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            重新选择
          </button>
        )}
      </div>

      {/* Selected preview */}
      {selected.length > 0 && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">你的选择:</div>
          <div className="flex gap-2">
            {selected.map((attr) => (
              <span
                key={attr}
                className="px-3 py-1 rounded text-sm font-bold"
                style={{
                  backgroundColor: ATTRIBUTE_COLORS[attr].primary,
                  color: '#000',
                }}
              >
                {attr}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
