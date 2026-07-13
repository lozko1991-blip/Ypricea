import { SaxesParser } from 'saxes';

async function checkIPosud() {
  console.log('Downloading i-Posud source XML...');
  const res = await fetch('https://i-posud.com.ua/assets/export/xml/prom_export_sklad.xml');
  const xml = await res.text();
  
  const parser = new SaxesParser();
  let hasParent = false;
  let categoryCount = 0;

  parser.on('opentag', (node) => {
    if (node.name === 'category') {
      categoryCount++;
      if (node.attributes.parentId || node.attributes.parentID) {
        hasParent = true;
      }
    }
  });

  parser.write(xml).close();
  console.log(`i-Posud: total categories = ${categoryCount}, has any parentId = ${hasParent}`);
}

async function checkOptDrop() {
  console.log('Downloading Opt-Drop source XML...');
  const res = await fetch('https://opt-drop.com/storage/xml/opt-drop-1.xml');
  const xml = await res.text();
  
  const parser = new SaxesParser();
  let hasParent = false;
  let categoryCount = 0;

  parser.on('opentag', (node) => {
    if (node.name === 'category') {
      categoryCount++;
      if (node.attributes.parentId || node.attributes.parentID) {
        hasParent = true;
      }
    }
  });

  parser.write(xml).close();
  console.log(`Opt-Drop: total categories = ${categoryCount}, has any parentId = ${hasParent}`);
}

async function main() {
  await checkIPosud();
  await checkOptDrop();
}

main().catch(console.error);
