import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

export type Credential = { name: string; login: string; password: string; group: string };

export function credentialsDocument(records: Credential[]): TDocumentDefinitions {
  if (!records.length) throw new Error('Нет доступов для выгрузки.');
  const groups = new Map<string, Credential[]>();
  for (const record of records) {
    const group = record.group || 'Администраторы';
    groups.set(group, [...(groups.get(group) ?? []), record]);
  }
  const content: Content[] = [];
  for (const [group, members] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true }))) {
    const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.login.localeCompare(b.login));
    const body: TableCell[][] = [
      [{ text: group === 'Администраторы' ? group : `Группа ${group}`, colSpan: 6, style: 'groupTitle', border: [false, false, false, false], margin: [0, 0, 0, 12] }, {}, {}, {}, {}, {}],
      ['ФИО', 'Логин', 'Пароль', 'ФИО', 'Логин', 'Пароль'].map(text => ({ text, style: 'columnTitle' })),
    ];
    for (let index = 0; index < sorted.length; index += 2) {
      const pair = [sorted[index], sorted[index + 1]];
      body.push(pair.flatMap(member => member ? [
        { text: member.name },
        { text: member.login, noWrap: true },
        { text: member.password, noWrap: true },
      ] : [{ text: '' }, { text: '' }, { text: '' }]));
    }
    content.push({
      ...(content.length ? { pageBreak: 'before' as const } : {}),
      table: { headerRows: 2, dontBreakRows: true, widths: ['*', 72, 76, '*', 72, 76], body },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#000000',
        vLineColor: () => '#000000',
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: (row: number) => row === 0 ? 0 : 4,
        paddingBottom: (row: number) => row === 0 ? 0 : 4,
        fillColor: (row: number) => row === 1 ? '#edf2f7' : null,
      },
    });
  }
  return {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [24, 24, 24, 32],
    info: { title: 'Доступы к тестированию' },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#171717' },
    styles: { groupTitle: { fontSize: 16, bold: true }, columnTitle: { bold: true } },
    content,
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'right', margin: [24, 8, 24, 0], fontSize: 10, color: '#64748b' }),
  };
}

export async function downloadCredentialsPdf(records: Credential[]) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.vfs = (fonts as unknown as { pdfMake: { vfs: Record<string, string> } }).pdfMake.vfs;
  const document = credentialsDocument(records);
  const groups = new Set(records.map(r => r.group));
  const name = groups.size === 1 && records[0].group ? `Доступы-${records[0].group}` : 'Доступы-к-тестированию';
  const filename = `${name.replace(/[<>:"/\\|?*]/g, '-')}.pdf`;
  await new Promise<void>(resolve => pdfMake.createPdf(document).download(filename, resolve));
}
