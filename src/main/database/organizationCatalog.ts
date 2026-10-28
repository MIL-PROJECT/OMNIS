// Publicly documented unit/department names only. A parent entry is not proof of its internal structure.
type Entry = {
  id: string
  name: string
  level: 'WING' | 'BRIGADE' | 'GROUP'
  url: string
  date: string
  department?: string
}
const news = (path: string) =>
  `https://kookbang.dema.mil.kr/newsWeb/${path}/view.do`
const brigade = news('20250415/1/ATCE_CTGR_0010050000')
export const organizationCatalog: Entry[] = [
  {
    id: 'W01',
    name: '제1전투비행단',
    level: 'WING',
    url: news('m/20210730/3/ATCE_CTGR_0010050000'),
    date: '2021-07-29',
    department: '정보통신대대'
  },
  {
    id: 'W03',
    name: '제3훈련비행단',
    level: 'WING',
    url: news('20260202/2/ATCE_CTGR_0010050000'),
    date: '2026-01-30',
    department: '정보통신대대'
  },
  {
    id: 'W05',
    name: '제5공중기동비행단',
    level: 'WING',
    url: news('20261002/2/ATCE_CTGR_0010050000'),
    date: '2026-10-01',
    department: '정보통신대대'
  },
  {
    id: 'W08',
    name: '제8전투비행단',
    level: 'WING',
    url: 'https://www.iwjnews.com/news/articleView.html?idxno=49676',
    date: '2022-09-21',
    department: '정보통신대대'
  },
  {
    id: 'W10',
    name: '제10전투비행단',
    level: 'WING',
    url: news('20161013/1/ATCE_CTGR_0010050000'),
    date: '2016-10-12',
    department: '정보통신대대'
  },
  {
    id: 'W11',
    name: '제11전투비행단',
    level: 'WING',
    url: news('20260716/2/ATCE_CTGR_0010050000'),
    date: '2026-07-15',
    department: '정보통신대대'
  },
  {
    id: 'W15',
    name: '제15특수임무비행단',
    level: 'WING',
    url: 'https://www.newsis.com/view/NISX20210702_0001498839',
    date: '2021-07-02',
    department: '정보통신대대'
  },
  {
    id: 'W16',
    name: '제16전투비행단',
    level: 'WING',
    url: 'https://www.yeongnam.com/web/view.php?key=20191216.010280726400001',
    date: '2019-12-16',
    department: '정보통신대대'
  },
  {
    id: 'W17',
    name: '제17전투비행단',
    level: 'WING',
    url: 'https://www.yna.co.kr/amp/view/AKR20150702141800064',
    date: '2015-07-02',
    department: '정보통신대대 / 기지통신반'
  },
  {
    id: 'W18',
    name: '제18전투비행단',
    level: 'WING',
    url: news('m/20230731/2/ATCE_CTGR_0010050000'),
    date: '2023-07-28',
    department: '정보통신대대'
  },
  {
    id: 'W19',
    name: '제19전투비행단',
    level: 'WING',
    url: news('20260714/3/ATCE_CTGR_0010050000'),
    date: '2026-07-13',
    department: '정보통신대대'
  },
  {
    id: 'W20',
    name: '제20전투비행단',
    level: 'WING',
    url: 'https://m.joongdo.co.kr/view.php?key=20210122010008176',
    date: '2021-01-22',
    department: '정보통신대대'
  },
  {
    id: 'W39',
    name: '제39정찰비행단',
    level: 'WING',
    url: news('20260409/2/ATCE_CTGR_0010050000'),
    date: '2026-04-08'
  },
  ...[1, 2, 3].map((n) => ({
    id: `B0${n}`,
    name: `제${n}미사일방어여단`,
    level: 'BRIGADE' as const,
    url: brigade,
    date: '2025-04-14'
  })),
  {
    id: 'G06',
    name: '제6탐색구조비행전대',
    level: 'GROUP',
    url: news('20200904/4/BBSMSTR_000000010026'),
    date: '2020-09-03'
  },
  {
    id: 'G07',
    name: '제7항공통신전대',
    level: 'GROUP',
    url: news('20221206/5/BBSMSTR_000000010024'),
    date: '2022-12-05',
    department: '제7항공통신전대'
  },
  {
    id: 'G38',
    name: '제38전투비행전대',
    level: 'GROUP',
    url: 'https://www.newsis.com/view/?id=NISX20210317_0001374232&pc_view=1',
    date: '2021-03-17'
  },
  {
    id: 'G29',
    name: '제29전술개발훈련비행전대',
    level: 'GROUP',
    url: news('20250103/3/ATCE_CTGR_0010050000'),
    date: '2025-01-02'
  },
  {
    id: 'G51',
    name: '제51항공통제비행전대',
    level: 'GROUP',
    url: news('20260713/8/ATCE_CTGR_0010050000'),
    date: '2026-07-10'
  },
  {
    id: 'G53',
    name: '제53특수비행전대',
    level: 'GROUP',
    url: news('20250708/1/ATCE_CTGR_0010050000'),
    date: '2025-07-07'
  }
]
