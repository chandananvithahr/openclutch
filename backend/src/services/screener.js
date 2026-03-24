const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchPage(symbol) {
  const url = `https://www.screener.in/company/${symbol.toUpperCase()}/consolidated/`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return cheerio.load(res.data);
}

// Parse any table in a section — returns { headers, rows }
function parseTable($, sectionId) {
  const section = $(`#${sectionId}`);
  if (!section.length) return null;

  const headers = [];
  section.find('table thead th').each((_, th) => {
    headers.push($(th).text().trim());
  });

  const rows = [];
  section.find('table tbody tr').each((_, tr) => {
    const cells = [];
    $(tr).find('td').each((_, td) => cells.push($(td).text().trim().replace(/\n/g, ' ')));
    if (cells.length > 0) rows.push(cells);
  });

  return { headers, rows };
}

// Get annual financials (P&L, Balance Sheet) — last 3 years
async function getFinancials(symbol) {
  let $;
  try {
    $ = await fetchPage(symbol);
  } catch (err) {
    if (err.response?.status === 404) return { error: `Company "${symbol}" not found on Screener.in. Check the NSE symbol.` };
    return { error: `Failed to fetch data: ${err.message}` };
  }

  const companyName = $('h1').first().text().trim();

  // Key ratios
  const ratios = {};
  $('.company-ratios li, #top-ratios li').each((_, el) => {
    const name = $(el).find('.name').text().trim();
    const value = $(el).find('.nowrap').text().trim() || $(el).find('span').last().text().trim();
    if (name && value) ratios[name] = value;
  });

  const profitLoss = parseTable($, 'profit-loss');
  const balanceSheet = parseTable($, 'balance-sheet');
  const cashFlow = parseTable($, 'cash-flow');

  // Trim to last 3 years (last 3 data columns, first col is row label)
  const trim3Years = (table) => {
    if (!table) return null;
    const totalCols = table.headers.length;
    const keepFrom = Math.max(1, totalCols - 3);
    return {
      headers: ['Metric', ...table.headers.slice(keepFrom)],
      rows: table.rows.map(r => [r[0], ...r.slice(keepFrom)]),
    };
  };

  return {
    company: companyName,
    symbol: symbol.toUpperCase(),
    source: `https://www.screener.in/company/${symbol.toUpperCase()}/consolidated/`,
    key_ratios: ratios,
    profit_loss_3yr: trim3Years(profitLoss),
    balance_sheet_3yr: trim3Years(balanceSheet),
    cash_flow_3yr: trim3Years(cashFlow),
  };
}

// Get last 8 quarters of results
async function getQuarterlyResults(symbol) {
  let $;
  try {
    $ = await fetchPage(symbol);
  } catch (err) {
    if (err.response?.status === 404) return { error: `Company "${symbol}" not found on Screener.in.` };
    return { error: `Failed to fetch data: ${err.message}` };
  }

  const companyName = $('h1').first().text().trim();
  const quarterly = parseTable($, 'quarters');

  if (!quarterly) return { error: 'Quarterly data not found for this company.' };

  // Last 8 quarters
  const totalCols = quarterly.headers.length;
  const keepFrom = Math.max(1, totalCols - 8);

  return {
    company: companyName,
    symbol: symbol.toUpperCase(),
    source: `https://www.screener.in/company/${symbol.toUpperCase()}/consolidated/`,
    quarters: {
      headers: ['Metric', ...quarterly.headers.slice(keepFrom)],
      rows: quarterly.rows.map(r => [r[0], ...r.slice(keepFrom)]),
    },
  };
}

// Get concall transcripts and documents
async function getConcalls(symbol) {
  let $;
  try {
    $ = await fetchPage(symbol);
  } catch (err) {
    if (err.response?.status === 404) return { error: `Company "${symbol}" not found on Screener.in.` };
    return { error: `Failed to fetch data: ${err.message}` };
  }

  const companyName = $('h1').first().text().trim();
  const concalls = [];

  // Screener shows concall/documents in #documents section
  $('#documents .concall, .documents-list .concall, #concalls .concall').each((_, el) => {
    const title = $(el).find('a').text().trim();
    const link = $(el).find('a').attr('href');
    const date = $(el).find('.date').text().trim();
    if (title) concalls.push({ title, date, link });
  });

  // Fallback: grab all document links mentioning concall/transcript
  if (concalls.length === 0) {
    $('a[href]').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const href = $(el).attr('href') || '';
      if ((text.includes('concall') || text.includes('transcript') || text.includes('conference call')) && href) {
        concalls.push({
          title: $(el).text().trim(),
          link: href.startsWith('http') ? href : `https://www.screener.in${href}`,
          date: '',
        });
      }
    });
  }

  // Also grab management commentary from the page if available
  const commentary = [];
  $('.commentary p, .concall-notes p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50) commentary.push(text);
  });

  return {
    company: companyName,
    symbol: symbol.toUpperCase(),
    source: `https://www.screener.in/company/${symbol.toUpperCase()}/consolidated/`,
    concall_documents: concalls.slice(0, 10),
    management_commentary: commentary.slice(0, 5),
    note: concalls.length === 0
      ? 'No concall transcripts found on Screener.in. Try checking the company IR website directly.'
      : `Found ${concalls.length} concall documents.`,
  };
}

module.exports = { getFinancials, getQuarterlyResults, getConcalls };
