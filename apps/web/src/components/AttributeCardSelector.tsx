import { useState } from 'react';
import { Attribute, ATTRIBUTE_COLORS } from '@psylent/shared';

interface AttributeCardSelectorProps {
  onSelect: (attributes: [Attribute, Attribute]) => void;
  disabled?: boolean;
  options?: Attribute[]; // 玩家被分配的3张属性牌
}

// 属性到幻影卡图片的映射 - 按THUNDER, HEAT, PSYCHIC, FATE, SPACE, SPIRIT顺序
const ATTRIBUTE_TO_PHANTOM_IMAGE: Record<Attribute, string> = {
  THUNDER: '/assets/cards/phantom/phantom_1.png',  // 雷电 - 黄色
  HEAT: '/assets/cards/phantom/phantom_2.png',      // 热源 - 红色
  PSYCHIC: '/assets/cards/phantom/phantom_3.png',   // 念动 - 紫色
  FATE: '/assets/cards/phantom/phantom_4.png',      // 命运 - 青色
  SPACE: '/assets/cards/phantom/phantom_5.png',     // 空间 - 蓝色
  SPIRIT: '/assets/cards/phantom/phantom_6.png',    // 具现 - 粉色
};

// 属性中文名
const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  HEAT: '热源',
  THUNDER: '雷电',
  SPACE: '空间',
  PSYCHIC: '念动',
  FATE: '命运',
  SPIRIT: '具现',
};

export function AttributeCardSelector({ onSelect, disabled, options }: AttributeCardSelectorProps) {
  const [selected, setSelected] = useState<Attribute[]>([]);

  // 等待服务器分配属性牌
  if (!options || options.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8 p-8 bg-gray-900/90 rounded-2xl border-2 border-gray-700 max-w-4xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2 pixel-font">等待分配属性牌</h2>
          <p className="text-gray-400">系统正在为你分配3张属性牌...</p>
        </div>
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // 只使用服务器分配的选项
  const availableAttributes = options;

  const handleAttributeClick = (attr: Attribute) => {
    if (disabled) return;

    if (selected.includes(attr)) {
      setSelected(selected.filter(a => a !== attr));
    } else if (selected.length < 2) {
      setSelected([...selected, attr]);
    }
  };

  const handleConfirm = () => {
    if (selected.length === 2) {
      onSelect([selected[0], selected[1]]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8 bg-gray-900/90 rounded-2xl border-2 border-gray-700 max-w-4xl">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 pixel-font">选择你的属性</h2>
        <p className="text-gray-400">系统已为你分配3张属性牌，请选择其中2张作为你的隐藏身份</p>
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        {availableAttributes.map((attr) => {
          const isSelected = selected.includes(attr);
          const colors = ATTRIBUTE_COLORS[attr];

          return (
            <button
              key={attr}
              onClick={() => handleAttributeClick(attr)}
              disabled={disabled || (!isSelected && selected.length >= 2)}
              className={`
                relative w-48 h-72 rounded-xl border-4 transition-all duration-200
                overflow-hidden
                ${isSelected
                  ? 'scale-105 shadow-lg shadow-yellow-400/50'
                  : 'opacity-80 hover:opacity-100 hover:scale-102'
                }
                ${disabled || (!isSelected && selected.length >= 2)
                  ? 'cursor-not-allowed opacity-40'
                  : 'cursor-pointer'
                }
              `}
              style={{
                borderColor: isSelected ? colors.secondary : 'transparent',
              }}
            >
              {/* Phantom card image */}
              <img
                src={ATTRIBUTE_TO_PHANTOM_IMAGE[attr]}
                alt={attr}
                className="w-full h-full object-cover"
              />

              {/* Overlay for selection state */}
              {isSelected && (
                <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    ✓
                  </div>
                </div>
              )}

              {/* Order indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold shadow-lg">
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
            <span className="text-gray-500">请点击选择第一张属性牌</span>
          )}
          {selected.length === 1 && (
            <span className="text-yellow-400">请选择第二张属性牌</span>
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
          <div className="flex gap-4">
            {selected.map((attr) => (
              <div key={attr} className="flex flex-col items-center gap-2">
                <img
                  src={ATTRIBUTE_TO_PHANTOM_IMAGE[attr]}
                  alt={attr}
                  className="w-24 h-36 object-cover rounded"
                />
                <span
                  className="px-3 py-1 rounded text-sm font-bold"
                  style={{
                    backgroundColor: ATTRIBUTE_COLORS[attr].primary,
                    color: '#000',
                  }}
                >
                  {ATTRIBUTE_NAMES[attr]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
