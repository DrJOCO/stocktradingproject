// S&P 500 stocks organized by sector for smart scanning

export const SECTOR_ETFS = {
  "Technology":     "XLK",
  "Financials":     "XLF",
  "Energy":         "XLE",
  "Healthcare":     "XLV",
  "Industrials":    "XLI",
  "Comm Services":  "XLC",
  "Cons Discretion": "XLY",
  "Cons Staples":   "XLP",
  "Utilities":      "XLU",
  "Real Estate":    "XLRE",
  "Materials":      "XLB",
};

export const SECTOR_STOCKS = {
  "Technology": [
    "AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","ADBE","CSCO","QCOM",
    "TXN","INTC","MU","AMAT","LRCX","KLAC","NOW","SNPS","CDNS","PANW",
    "FTNT","CRWD","DDOG","ZS","NET","PLTR","SNOW","MDB","TEAM","WDAY",
  ],
  "Financials": [
    "JPM","V","MA","BAC","GS","MS","AXP","BLK","C","WFC",
    "SCHW","MMC","CB","ICE","CME","AON","PGR","TRV","AIG","MET",
  ],
  "Energy": [
    "XOM","CVX","COP","SLB","EOG","OXY","MPC","PSX","VLO","HAL",
    "DVN","FANG","HES","BKR","TRGP","WMB","KMI","OKE","CTRA","EQT",
  ],
  "Healthcare": [
    "UNH","JNJ","LLY","PFE","MRK","ABBV","TMO","ABT","BMY","AMGN",
    "GILD","MDT","SYK","ISRG","BSX","DHR","ZTS","REGN","VRTX","CI",
  ],
  "Industrials": [
    "CAT","DE","UNP","BA","HON","GE","RTX","LMT","MMM","UPS",
    "FDX","EMR","ITW","WM","RSG","NSC","CSX","PCAR","GD","NOC",
  ],
  "Comm Services": [
    "META","GOOGL","GOOG","NFLX","DIS","CMCSA","T","VZ","TMUS","CHTR",
    "EA","TTWO","WBD","PARA","MTCH","LYV","FOXA","OMC","IPG","NWSA",
  ],
  "Cons Discretion": [
    "AMZN","TSLA","HD","MCD","NKE","SBUX","TGT","COST","LOW","TJX",
    "BKNG","MAR","HLT","CMG","DHI","LEN","GM","F","ROST","ORLY",
  ],
  "Cons Staples": [
    "PG","KO","PEP","WMT","COST","PM","MO","CL","KMB","GIS",
    "SYY","HSY","K","ADM","MNST","STZ","TSN","CAG","KHC","CHD",
  ],
  "Utilities": [
    "NEE","SO","DUK","D","SRE","AEP","EXC","XEL","WEC","ED",
    "ES","AWK","DTE","AEE","CMS","EIX","PPL","FE","CNP","EVRG",
  ],
  "Real Estate": [
    "PLD","AMT","CCI","EQIX","PSA","SPG","O","WELL","DLR","AVB",
    "EQR","VTR","MAA","UDR","ARE","KIM","REG","BXP","HST","PEAK",
  ],
  "Materials": [
    "LIN","APD","SHW","ECL","FCX","NEM","NUE","DOW","DD","VMC",
    "MLM","IFF","FMC","ALB","CE","CF","MOS","PKG","IP","SEE",
  ],
};

// Flatten all stocks for full scan
export const ALL_STOCKS = Object.values(SECTOR_STOCKS).flat();

// Quick-scan set: sector ETFs + top 5 most liquid per sector
export const QUICK_SCAN = [
  ...Object.values(SECTOR_ETFS),
  // Top 5 per sector
  "AAPL","MSFT","NVDA","AVGO","ORCL",
  "JPM","V","MA","BAC","GS",
  "XOM","CVX","COP","SLB","EOG",
  "UNH","JNJ","LLY","PFE","MRK",
  "CAT","DE","UNP","BA","HON",
  "META","GOOGL","NFLX","DIS","CMCSA",
  "AMZN","TSLA","HD","MCD","NKE",
  "PG","KO","PEP","WMT","PM",
  "NEE","SO","DUK","D","SRE",
  "PLD","AMT","CCI","EQIX","PSA",
  "LIN","APD","SHW","ECL","FCX",
];
