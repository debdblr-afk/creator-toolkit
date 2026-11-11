// A small fictional channel, so a first-time visitor can see every tool with data in it.
// Everything here is invented. Ids are fixed, so loading it twice never duplicates anything.

import { read, write } from './store'
import { DEFAULT_SETTINGS, type Brand, type Chapter, type Idea, type OutlineSection, type Promo, type ScriptDoc, type Series, type Settings, type StreakConfig, type Video } from './data'
import { addDays, today } from './util'
import type { Competitor } from '../features/plan/Competitors'
import type { NicheDoc } from '../features/plan/Niche'
import type { Shot } from '../features/script/ShotList'
import type { DescDoc } from '../features/publish/Description'
import type { TagSet } from '../features/publish/TagSets'
import type { ChannelStat, VideoStat } from '../features/grow/Analytics'
import type { Deal } from '../features/grow/Deals'
import type { Goal } from '../features/grow/Goals'

function mergeList<T extends { id: string }>(key: string, items: T[]): void {
  write<T[]>(key, (prev) => [...prev.filter((p) => !items.some((i) => i.id === p.id)), ...items], [])
}

function mergeDocs<T>(key: string, docs: Record<string, T>): void {
  write<Record<string, T>>(key, (prev) => ({ ...prev, ...docs }), {})
}

const SCRIPT = `# Hook
You do not need a wall of jars. Six spices cover almost everything I cook, and they fit in a shoebox.

# Why six
[B-roll: overflowing spice drawer]
When I moved into a flat with four square metres of kitchen, I owned thirty jars and used about five of them.
So I ran a test. For one month I wrote down every spice I reached for.

# The six
[Graphic: the six spices listed]
Number one is cumin. It does the heavy lifting in anything with beans, lentils or roasted vegetables.
Number two is smoked paprika, for when you want dinner to taste like it met a grill.
Then chilli flakes, turmeric, black pepper, and one blend you actually like.

# Storing them
[B-roll: tins stacked on a magnet strip]
Buy small amounts, keep them away from the hob, and label the lids, not the sides.

# Wrap up
The full shopping list is in the description.
Next week I am opening my fridge, so subscribe if you want to see how 120 litres stays organised.`

export function loadSample(): void {
  const now = today()
  const day = (offset: number) => addDays(now, offset)
  const stamp = Date.now()
  const currency = read<Settings>('settings', DEFAULT_SETTINGS).currency ?? DEFAULT_SETTINGS.currency
  // Keep the invented money figures believable in the visitor's own currency.
  const rupees = currency === 'INR'
  const fee = (n: number) => (rupees ? n * 80 : n)
  const adRevenue = (views: number) => Math.round(views * (rupees ? 0.12 : 0.003) * 100) / 100

  const videos: Video[] = [
    { id: 's-v1', title: '5 one-pan dinners for a tiny kitchen', stage: 'published', publishDate: day(-19), createdAt: stamp - 7 },
    { id: 's-v2', title: 'I meal-prepped a week of lunches in 90 minutes', stage: 'published', publishDate: day(-12), createdAt: stamp - 6 },
    { id: 's-v3', title: 'Knife skills for beginners: 4 cuts you actually need', stage: 'published', publishDate: day(-5), seriesId: 's-s1', createdAt: stamp - 5 },
    { id: 's-v5', title: 'Budget kitchen tools tested: what is worth it', stage: 'editing', publishDate: day(9), createdAt: stamp - 4 },
    { id: 's-v6', title: 'Fridge tour: how I organise 120 litres', stage: 'scripting', publishDate: day(16), seriesId: 's-s1', createdAt: stamp - 3 },
    { id: 's-v7', title: 'Is an air fryer worth the counter space?', stage: 'planned', createdAt: stamp - 2 },
    {
      id: 's-v4',
      title: 'The only 6 spices a small kitchen needs',
      stage: 'scheduled',
      publishDate: day(2),
      seriesId: 's-s1',
      notes: 'Shot on the new counter. Lead with the shoebox.',
      createdAt: stamp - 1,
    },
  ]
  mergeList('videos', videos)
  write<string>('currentVideoId', 's-v4', '')

  const ideas: Idea[] = [
    { id: 's-i1', title: 'I cooked only from my freezer for a week', notes: 'Challenge format. Track cost per meal on screen.', tags: ['challenge'], rating: 4, createdAt: stamp - 50 },
    { id: 's-i2', title: 'Three sauces that fix a boring dinner', notes: 'Each under five minutes and four ingredients.', tags: ['basics'], rating: 5, createdAt: stamp - 40 },
    { id: 's-i3', title: 'Rating every cheap non-stick pan I own', notes: '', tags: ['gear'], rating: 3, createdAt: stamp - 30 },
    { id: 's-i4', title: 'What I eat in a week on a student budget', notes: 'Asked for twice in the comments.', tags: ['budget'], rating: 4, createdAt: stamp - 20 },
    { id: 's-i5', title: 'Is an air fryer worth the counter space?', notes: '', tags: ['gear'], rating: 4, createdAt: stamp - 10, videoId: 's-v7' },
  ]
  mergeList('ideas', ideas)

  const series: Series[] = [
    { id: 's-s1', name: 'Small Kitchen Basics', premise: 'One essential skill or decision per episode, shown in a kitchen with a single hob and almost no storage.', cadence: 'every second Thursday' },
  ]
  mergeList('series', series)

  const competitors: Competitor[] = [
    {
      id: 's-c1',
      name: 'Pan and Plan',
      url: '',
      subs: 182000,
      cadence: 'twice a week',
      strengths: 'Fast cuts, a recipe card on screen, titles that promise a time limit.',
      gaps: 'Assumes a full-size oven and a lot of equipment. Rarely answers budget questions.',
      ideas: 'One hob, one pan: a full week of dinners',
      updatedAt: stamp,
    },
    {
      id: 's-c2',
      name: 'Shelf Life Kitchen',
      url: '',
      subs: 46000,
      cadence: 'weekly',
      strengths: 'Calm delivery and very clear storage advice.',
      gaps: 'Long intros. Thumbnails look alike, so new videos are easy to miss.',
      ideas: '',
      updatedAt: stamp,
    },
  ]
  mergeList('competitors', competitors)

  const niche: NicheDoc = {
    topic: 'small-space cooking',
    viewer: 'people cooking in small or shared kitchens',
    problem: 'no space, few tools and a tight budget',
    outcome: 'cook real meals with what they already have',
    angle: 'everything is filmed in a four square metre kitchen with one hob',
    formats: ['Tutorials', 'Reviews'],
    cadence: 'one video every Thursday',
    length: '6 to 10 minutes',
    pillars: [
      { id: 's-p1', name: 'One-pan meals', example: 'One hob, one pan: a full week of dinners' },
      { id: 's-p2', name: 'Kitchen basics', example: 'Three sauces that fix a boring dinner' },
      { id: 's-p3', name: 'Gear worth the space', example: 'Is an air fryer worth the counter space?' },
    ],
    hangouts: 'Student and first-flat forums, budget cooking communities',
    searches: 'small kitchen cooking\ncooking with one pan\nessential spices for beginners',
  }
  write<NicheDoc | null>('niche', niche, null)

  const brand: Brand = {
    channel: 'Tiny Kitchen Lab',
    tagline: 'Big meals from small kitchens',
    colors: ['#e5432a', '#1f2a24', '#fff6e5', '#f5b800'],
    font: 'Anton',
    logo: '',
    voice: 'Warm, direct, a little dry. Always metric. Never asks viewers to smash anything.',
  }
  write<Brand | null>('brand', brand, null)

  mergeDocs<ScriptDoc>('scripts', { 's-v4': { body: SCRIPT } })

  const outline: OutlineSection[] = [
    { id: 's-o1', heading: 'Hook', notes: 'Hold up the shoebox', seconds: 20 },
    { id: 's-o2', heading: 'Why six', notes: 'The one-month test', seconds: 60 },
    { id: 's-o3', heading: 'The six', notes: 'Cumin\nSmoked paprika\nChilli flakes, turmeric, pepper, one blend', seconds: 180 },
    { id: 's-o4', heading: 'Storing them', notes: 'Small amounts, away from heat, label the lids', seconds: 70 },
    { id: 's-o5', heading: 'Wrap up', notes: 'Point to the fridge tour', seconds: 30 },
  ]
  mergeDocs<OutlineSection[]>('outlines', { 's-v4': outline })

  const chapters: Chapter[] = [
    { id: 's-ch1', time: 0, title: 'The short answer' },
    { id: 's-ch2', time: 20, title: 'Why six is enough' },
    { id: 's-ch3', time: 80, title: 'The six spices' },
    { id: 's-ch4', time: 260, title: 'Storing them in a small space' },
    { id: 's-ch5', time: 330, title: 'What is next' },
  ]
  mergeDocs<Chapter[]>('chapters', { 's-v4': chapters })

  const shots: Shot[] = [
    { id: 's-sh1', type: 'A-roll', desc: 'Intro at the counter with the shoebox', location: 'Kitchen', done: true },
    { id: 's-sh2', type: 'B-roll', desc: 'overflowing spice drawer', location: 'Kitchen', done: true },
    { id: 's-sh3', type: 'Graphic', desc: 'the six spices listed', location: '', done: false },
    { id: 's-sh4', type: 'B-roll', desc: 'tins stacked on a magnet strip', location: 'Kitchen', done: false },
    { id: 's-sh5', type: 'Insert', desc: 'Close-up of labelled lids', location: 'Kitchen', done: false },
  ]
  mergeDocs<Shot[]>('shots', { 's-v4': shots })

  mergeDocs<string[]>('titles', {
    's-v4': ['The Only 6 Spices a Small Kitchen Needs', '6 Spices That Cover Almost Everything', 'Stop Buying Spices You Never Use'],
  })
  mergeDocs<string[]>('videoTags', {
    's-v4': ['essential spices', 'spices for beginners', 'small kitchen', 'tiny kitchen cooking', 'kitchen organisation'],
  })

  const description: DescDoc = {
    intro: 'Six spices cover almost everything I cook in a four square metre kitchen. Here is which ones, why, and how I store them.',
    blockIds: ['links', 'about'],
    chapters: true,
    hashtags: 'smallkitchen, spices, cookingbasics',
  }
  mergeDocs<DescDoc>('descriptions', { 's-v4': description })

  const tagSets: TagSet[] = [{ id: 's-t1', name: 'Channel basics', tags: ['tiny kitchen lab', 'small kitchen', 'cooking for beginners', 'budget cooking'] }]
  mergeList('tagSets', tagSets)

  const title = 'The only 6 spices a small kitchen needs'
  const promos: Promo[] = [
    { id: 's-pr1', videoId: 's-v4', kind: 'community', date: day(0), text: `Coming in two days: ${title}. Any guesses which six made the cut?`, status: 'posted' },
    { id: 's-pr2', videoId: 's-v4', kind: 'short', date: day(1), text: 'The shoebox reveal, 20 seconds. End on: which six?', status: 'drafted' },
    { id: 's-pr3', videoId: 's-v4', kind: 'community', date: day(2), text: `It is live: ${title}. Watch here: [link]`, status: 'idea' },
    { id: 's-pr4', videoId: 's-v4', kind: 'poll', date: day(4), text: 'Poll: what should the next basics video cover?\nOption 1: Knives\nOption 2: Pans\nOption 3: Storage', status: 'idea' },
  ]
  mergeList('promos', promos)

  const stat = (id: string, videoId: string, date: string, views: number, impressions: number, ctr: number, avd: number, length: number, subs: number): VideoStat => ({
    id,
    videoId,
    title: videos.find((v) => v.id === videoId)?.title ?? '',
    date,
    views,
    impressions,
    ctr,
    avd,
    length,
    subs,
    revenue: adRevenue(views),
  })
  mergeList('videoStats', [
    stat('s-vs1', 's-v1', day(-19), 4200, 61000, 5.1, 252, 540, 38),
    stat('s-vs2', 's-v2', day(-12), 6900, 84000, 6.3, 318, 700, 71),
    stat('s-vs3', 's-v3', day(-5), 3100, 52000, 4.4, 205, 485, 24),
  ])

  const channelStats: ChannelStat[] = [
    { id: 's-cs1', date: day(-35), subs: 412, views: 21000 },
    { id: 's-cs2', date: day(-28), subs: 448, views: 24800 },
    { id: 's-cs3', date: day(-21), subs: 471, views: 27900 },
    { id: 's-cs4', date: day(-14), subs: 529, views: 33400 },
    { id: 's-cs5', date: day(-7), subs: 603, views: 41200 },
    { id: 's-cs6', date: day(0), subs: 641, views: 45100 },
  ]
  mergeList('channelStats', channelStats)

  const deals: Deal[] = [
    { id: 's-d1', brand: 'Millstone Flour Co.', contact: 'Asha', email: '', value: fee(250), stage: 'pitched', deliverable: '45-second mention in one video', due: day(21), notes: 'They sponsor baking channels. Pitch the one-pan series.', createdAt: stamp },
    { id: 's-d2', brand: 'Oventide Cookware', contact: 'Jon', email: '', value: fee(600), stage: 'negotiating', deliverable: 'Dedicated review of the 20 cm pan', due: day(30), videoId: 's-v5', notes: 'Asked for 30 days of usage rights.', createdAt: stamp },
    { id: 's-d3', brand: 'Larder and Leaf', contact: 'Mina', email: '', value: fee(180), stage: 'paid', deliverable: 'Community post', notes: '', createdAt: stamp },
  ]
  mergeList('deals', deals)

  const goals: Goal[] = [
    { id: 's-g1', name: 'Reach 1,000 subscribers', unit: 'subscribers', start: 412, current: 641, target: 1000, deadline: day(90), createdAt: stamp },
    { id: 's-g2', name: 'Publish 12 videos', unit: 'videos published', start: 0, current: 3, target: 12, deadline: day(120), createdAt: stamp },
  ]
  mergeList('goals', goals)

  write<StreakConfig | null>('streak', { perWeek: 1 }, null)
}
