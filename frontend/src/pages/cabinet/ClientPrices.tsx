import React from 'react';
import { Loader2, PackageX, Download, Copy } from 'lucide-react';

interface AllowedExport {
  name: string;
  count?: number;
  url: string;
}

interface ClientPricesProps {
  exportsLoading: boolean;
  allowedExports: AllowedExport[];
  markupPct: number;
  setMarkupPct: (val: number) => void;
  markupGrn: number;
  setMarkupGrn: (val: number) => void;
  handleDownloadWithMarkup: (url: string, name: string) => void;
  showToast: (msg: string) => void;
}

export const ClientPrices: React.FC<ClientPricesProps> = ({
  exportsLoading,
  allowedExports,
  markupPct,
  setMarkupPct,
  markupGrn,
  setMarkupGrn,
  handleDownloadWithMarkup,
  showToast
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Markup adjustment controls */}
      <div className="card grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="sec-title mb-3 block">% від дроп-ціни</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {[10, 15, 20, 25, 30].map(v => (
              <button
                key={v}
                onClick={() => setMarkupPct(v)}
                className={`gbtn text-xs py-1 px-3 ${markupPct === v ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)]'}`}
              >
                +{v}%
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={markupPct}
              onChange={(e) => setMarkupPct(Math.max(0, Number(e.target.value)))}
              className="input-field w-24 text-xs font-bold py-1 px-2"
            />
            <span className="text-xs font-bold text-[var(--text2)]">%</span>
          </div>
        </div>

        <div>
          <h3 className="sec-title mb-3 block">Фіксована надбавка (грн)</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {[0, 50, 100, 150].map(v => (
              <button
                key={v}
                onClick={() => setMarkupGrn(v)}
                className={`gbtn text-xs py-1 px-3 ${markupGrn === v ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)]'}`}
              >
                +{v} ₴
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={markupGrn}
              onChange={(e) => setMarkupGrn(Math.max(0, Number(e.target.value)))}
              className="input-field w-24 text-xs font-bold py-1 px-2"
            />
            <span className="text-xs font-bold text-[var(--text2)]">₴</span>
          </div>
        </div>

        <div className="md:col-span-2 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text2)] leading-relaxed font-semibold">
          * Розрахунок кінцевих цін у завантаженому прайсі відбувається у вашому браузері: Ціна = Дроп × (1 + Націнка%/100) + Націнка ₴.
        </div>
      </div>

      {/* Allowed prices list */}
      <div className="card">
        <h2 className="text-sm font-black mb-4 flex items-center gap-2">
          Доступні прайси
        </h2>
        {exportsLoading ? (
          <div className="flex items-center justify-center py-10 text-[var(--text2)]">
            <Loader2 className="animate-spin mr-2" size={16} />
            Завантаження списку автопрайсів...
          </div>
        ) : allowedExports.length === 0 ? (
          <div className="text-center py-12 text-[var(--text2)]">
            <PackageX size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-extrabold text-xs">Прайси ще не призначені. Зверніться до адміністратора.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {allowedExports.map((e, idx) => (
              <div 
                key={e.name} 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--surface2)] border border-[var(--border)] rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-xs shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-xs text-[var(--text)]">{e.name}.xml</h3>
                    <span className="text-[10px] font-bold text-[var(--text2)]">
                      {e.count?.toLocaleString('uk-UA')} товарів
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownloadWithMarkup(e.url, e.name)}
                    className="gbtn bg-[var(--accent)] text-white text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    Завантажити
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(e.url);
                      showToast('📋 Посилання скопійовано!');
                    }}
                    className="gbtn bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs p-1.5"
                    title="Скопіювати посилання"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
