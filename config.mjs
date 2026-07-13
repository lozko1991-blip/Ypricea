import path from 'node:path';

export const CONFIG = {
  XML_URL: 'https://crm.yavshoke.ua/media/export/all_drop_opt_price.xml',
  MIN_DROP: 150,        // видаляти товари з price_drop < 150
  MARKUP_PCT: 20,       // дефолт націнки % (НЕ застосовується в базі; лише підказка для пресетів)
  MARKUP_GRN: 70,       // дефолт націнки грн (НЕ застосовується в базі; рахується при генерації)
  MIN_CAT_PRODUCTS: 5,  // листову категорію з < 5 (тобто ≤4) товарів — видалити
  OUT_DIR: 'frontend/public',      // куди писати сайт+дані (звідси деплоїться Pages)
  IMG_PREFIX: 'https://crm.yavshoke.ua/media/shop//', // спільний префікс фото
  SITE_URL: 'https://lozko1991-blip.github.io/Ypricea',

  // ── ШАРДИНГ КАТАЛОГУ (модель «як інтернет-магазин») ──
  SHARD_SIZE: 1000,     // товарів у шарді
  SHARDS_DIR: 'shards',
  DESC_DIR: 'desc',

  // ── MASTEREVA (другий постачальник) ──
  MASTEREVA_ENABLED: true,
  MASTEREVA_XML_URL: 'https://lozko1991-blip.github.io/xmlprice/Masterevanew.xml',
  MASTEREVA_MIN_PRICE: 0,
  MASTEREVA_PREFIXES: [
    { prefix: '1000', src: 'ev_dropt' },
    { prefix: '1100', src: 'ev_forus' },
    { prefix: '1111', src: 'ev_shkatulka' },
    { prefix: '2222', src: 'ev_optdrop' },
    { prefix: '3333', src: 'ev_lugi' },
    { prefix: '4444', src: 'ev_dropom' },
    { prefix: '5555', src: 'ev_royaltoys' },
    { prefix: '7777', src: 'ev_posudograd' },
    { prefix: '8888', src: 'ev_iposud' },
    { prefix: '9999', src: 'ev_websklad' },
    { prefix: '1200', src: 'ev_aveopt' },
    { prefix: '1300', src: 'ev_phantom' },
  ],
  MASTEREVA_DEFAULT_SRC: 'ev_kievopt',
  MASTEREVA_INCLUDE_DESC: true,
  MASTEREVA_DESC_MAX: 4000,
  MASTEREVA_MAX_PICS: 8,
};

export const DATA_DIR = path.join(CONFIG.OUT_DIR, 'data');
export const FULL_DIR = path.join(DATA_DIR, 'full');
export const TMP_XML = 'price.xml';
