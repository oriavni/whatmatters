-- ── discovery_sources ────────────────────────────────────────────────────────
-- Admin-managed library of curated sources for topic discovery.
-- Users never write to this table directly — they copy entries into their own
-- sources table via the discovery flow.

create table public.discovery_sources (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  url             text not null,           -- canonical website URL
  feed_url        text,                    -- RSS/Atom URL (null = not directly subscribable)
  source_type     text not null check (source_type in ('rss', 'newsletter', 'reddit', 'blog', 'report_site', 'community', 'other')),
  category        text not null,           -- AI / Startups / Technology / Business / Global Affairs / Culture / Science / Design / Media / Music
  tags            text[] not null default '{}',
  language        text not null default 'en',
  description     text not null,
  coolness_score  integer not null default 5 check (coolness_score between 1 and 10),
  freshness_score integer not null default 5 check (freshness_score between 1 and 10),
  trust_score     integer not null default 5 check (trust_score between 1 and 10),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Admins read/write; no public RLS needed (read-only for all authenticated users)
alter table public.discovery_sources enable row level security;

create policy "discovery_sources: authenticated read"
  on public.discovery_sources for select
  to authenticated
  using (is_active = true);

create index discovery_sources_category_idx on public.discovery_sources(category) where is_active = true;
create index discovery_sources_tags_idx     on public.discovery_sources using gin(tags) where is_active = true;

create trigger discovery_sources_updated_at
  before update on public.discovery_sources
  for each row execute function public.set_updated_at();

-- ── Seed: curated discovery library ──────────────────────────────────────────

insert into public.discovery_sources
  (name, url, feed_url, source_type, category, tags, description, coolness_score, freshness_score, trust_score)
values

-- ── AI & Machine Learning ────────────────────────────────────────────────────
('The Batch',
 'https://www.deeplearning.ai/the-batch/',
 'https://www.deeplearning.ai/the-batch/feed/',
 'newsletter', 'AI',
 array['ai','machine learning','research','weekly'],
 'Andrew Ng''s weekly letter covering the most important AI developments — research, industry, and applications.',
 9, 9, 10),

('Import AI',
 'https://importai.substack.com',
 'https://importai.substack.com/feed',
 'newsletter', 'AI',
 array['ai','research','policy','safety','weekly'],
 'Jack Clark''s weekly roundup of AI research papers, policy, and the frontiers of the field.',
 9, 8, 9),

('Hugging Face Blog',
 'https://huggingface.co/blog',
 'https://huggingface.co/blog/feed.xml',
 'blog', 'AI',
 array['ai','open source','models','ml engineering'],
 'Technical deep-dives and model releases from the team building the open-source AI ecosystem.',
 8, 9, 9),

('Interconnects',
 'https://www.interconnects.ai',
 'https://www.interconnects.ai/feed',
 'newsletter', 'AI',
 array['ai','rlhf','llm','research','alignment'],
 'Nathan Lambert''s sharp analysis of language model training, RLHF, and AI research — written for practitioners.',
 9, 8, 9),

('r/MachineLearning',
 'https://reddit.com/r/MachineLearning',
 'https://www.reddit.com/r/MachineLearning/.rss',
 'reddit', 'AI',
 array['ai','research','papers','ml'],
 'The research-focused AI community on Reddit. Paper discussions, benchmark debates, and practitioner insights.',
 8, 10, 8),

('r/LocalLLaMA',
 'https://reddit.com/r/LocalLLaMA',
 'https://www.reddit.com/r/LocalLLaMA/.rss',
 'reddit', 'AI',
 array['ai','llm','open source','self-hosted','models'],
 'Everything about running language models locally — model releases, performance comparisons, and community guides.',
 9, 10, 8),

('MIT Technology Review',
 'https://www.technologyreview.com',
 'https://www.technologyreview.com/feed/',
 'rss', 'AI',
 array['ai','technology','research','society'],
 'Long-form AI and technology journalism from one of the most respected science publications.',
 8, 8, 10),

-- ── Startups & Venture Capital ───────────────────────────────────────────────
('Lenny''s Newsletter',
 'https://www.lennysnewsletter.com',
 'https://www.lennysnewsletter.com/feed',
 'newsletter', 'Startups',
 array['product','growth','startups','career','saas'],
 'The go-to resource for product managers and growth practitioners. Highly practical, interview-driven.',
 10, 7, 9),

('Not Boring',
 'https://www.notboring.co',
 'https://www.notboring.co/feed',
 'newsletter', 'Startups',
 array['startups','technology','strategy','analysis'],
 'Packy McCormick''s deep-dives into companies and trends at the intersection of business and culture.',
 10, 7, 8),

('The Generalist',
 'https://thegeneralist.substack.com',
 'https://thegeneralist.substack.com/feed',
 'newsletter', 'Startups',
 array['startups','vc','strategy','technology'],
 'Mario Gabriele''s long-form profiles of companies and market landscapes — deep research, beautifully written.',
 9, 6, 9),

('r/startups',
 'https://reddit.com/r/startups',
 'https://www.reddit.com/r/startups/.rss',
 'reddit', 'Startups',
 array['startups','founder','entrepreneurship','early stage'],
 'Founder war stories, early-stage advice, and the unfiltered realities of building a startup.',
 7, 10, 7),

('r/SaaS',
 'https://reddit.com/r/SaaS',
 'https://www.reddit.com/r/SaaS/.rss',
 'reddit', 'Startups',
 array['saas','product','growth','mrr','founder'],
 'Revenue milestones, growth tactics, and honest founder discussions from the SaaS building community.',
 7, 10, 7),

('Hacker News',
 'https://news.ycombinator.com',
 'https://news.ycombinator.com/rss',
 'community', 'Startups',
 array['tech','startups','programming','culture','community'],
 'The canonical signal source for the tech and startup world. High noise-to-signal ratio, but the signal is real.',
 9, 10, 8),

('First Round Review',
 'https://review.firstround.com',
 'https://review.firstround.com/rss.xml',
 'blog', 'Startups',
 array['startups','management','product','growth','hiring'],
 'Long-form, tactical essays from founders and operators in the First Round portfolio. Evergreen quality.',
 9, 5, 10),

('Trends.vc',
 'https://trends.vc',
 null,
 'report_site', 'Startups',
 array['startups','trends','market','opportunities','research'],
 'Weekly deep-dives into emerging business trends, market gaps, and startup opportunities.',
 10, 8, 8),

-- ── Technology ───────────────────────────────────────────────────────────────
('Stratechery',
 'https://stratechery.com',
 'https://stratechery.com/feed/',
 'newsletter', 'Technology',
 array['technology','strategy','platforms','business','analysis'],
 'Ben Thompson''s razor-sharp analysis of the technology industry — business models, strategy, and power dynamics.',
 10, 8, 10),

('Daring Fireball',
 'https://daringfireball.net',
 'https://daringfireball.net/feeds/main',
 'blog', 'Technology',
 array['apple','technology','design','software'],
 'John Gruber''s essential Apple and technology commentary. Opinionated, accurate, and influential.',
 8, 9, 9),

('The Verge',
 'https://www.theverge.com',
 'https://www.theverge.com/rss/index.xml',
 'rss', 'Technology',
 array['technology','gadgets','platforms','science','culture'],
 'Consumer technology news and culture — from gadget reviews to platform policy deep-dives.',
 7, 10, 8),

('Ars Technica',
 'https://arstechnica.com',
 'https://feeds.arstechnica.com/arstechnica/index',
 'rss', 'Technology',
 array['technology','science','policy','security','hardware'],
 'Serious technology journalism with the depth that enthusiasts and professionals actually want.',
 8, 10, 9),

('Benedict Evans',
 'https://www.ben-evans.com',
 'https://www.ben-evans.com/benedictevans?format=rss',
 'newsletter', 'Technology',
 array['technology','platforms','strategy','market analysis'],
 'Calm, rigorous thinking about the structural shifts in technology and what they mean for markets and society.',
 9, 6, 9),

-- ── Business & Finance ───────────────────────────────────────────────────────
('Morning Brew',
 'https://www.morningbrew.com',
 'https://www.morningbrew.com/daily/issues.rss',
 'newsletter', 'Business',
 array['business','finance','markets','daily','news'],
 'A fast read on business, finance, and the economy — surprisingly good signal-to-noise for a broad publication.',
 7, 10, 8),

('Axios Pro Rata',
 'https://www.axios.com/pro/pro-rata',
 'https://api.axios.com/feed/columns/pro-rata',
 'newsletter', 'Business',
 array['vc','deals','startups','finance','m&a'],
 'Dan Primack''s authoritative coverage of venture capital, private equity, and M&A deals.',
 8, 9, 9),

('Defector',
 'https://defector.com',
 'https://defector.com/feed',
 'blog', 'Business',
 array['media','sports','culture','independent'],
 'Worker-owned media outlet known for sharp writing across sports, culture, and media criticism.',
 9, 9, 9),

-- ── Global Affairs ───────────────────────────────────────────────────────────
('Foreign Policy',
 'https://foreignpolicy.com',
 'https://foreignpolicy.com/feed/',
 'rss', 'Global Affairs',
 array['geopolitics','international','diplomacy','policy','analysis'],
 'Authoritative coverage of global politics, international security, and foreign affairs.',
 8, 9, 10),

('Rest of World',
 'https://restofworld.org',
 'https://restofworld.org/feed/',
 'rss', 'Global Affairs',
 array['technology','global','emerging markets','culture','society'],
 'Technology''s impact on the rest of the world — stories from markets most tech media ignores.',
 10, 8, 9),

('r/worldnews',
 'https://reddit.com/r/worldnews',
 'https://www.reddit.com/r/worldnews/.rss',
 'reddit', 'Global Affairs',
 array['news','international','politics','current events'],
 'Real-time global news aggregation with active discussion. Good for breaking events.',
 6, 10, 7),

('Politico',
 'https://www.politico.com',
 'https://www.politico.com/rss/politics08.xml',
 'rss', 'Global Affairs',
 array['politics','policy','government','us','europe'],
 'Inside-the-room political reporting across the US and Europe.',
 7, 10, 8),

-- ── Culture & Society ────────────────────────────────────────────────────────
('The Atlantic',
 'https://www.theatlantic.com',
 'https://www.theatlantic.com/feed/all/',
 'rss', 'Culture',
 array['culture','society','ideas','politics','science'],
 'Long-form journalism on ideas, culture, and society. One of the sharpest general-interest publications.',
 8, 8, 10),

('Garbage Day',
 'https://www.garbageday.email',
 'https://www.garbageday.email/feed',
 'newsletter', 'Culture',
 array['internet culture','social media','trends','media'],
 'Ryan Broderick''s essential guide to internet culture, viral trends, and what''s actually happening online.',
 10, 9, 8),

('The Pudding',
 'https://pudding.cool',
 'https://pudding.cool/feed/index.xml',
 'blog', 'Culture',
 array['culture','data visualization','journalism','society'],
 'Data-driven visual essays on culture and society. Every piece is original and beautifully made.',
 10, 5, 9),

('r/Futurology',
 'https://reddit.com/r/Futurology',
 'https://www.reddit.com/r/Futurology/.rss',
 'reddit', 'Culture',
 array['future','technology','society','science','trends'],
 'Discussions about the future of technology, society, and humanity. Optimistic and wide-ranging.',
 7, 10, 7),

('404 Media',
 'https://www.404media.co',
 'https://www.404media.co/rss/',
 'rss', 'Culture',
 array['technology','media','internet','journalism','independent'],
 'Independent tech and internet journalism from former Motherboard journalists. Sharp and uncompromising.',
 9, 9, 9),

-- ── Science & Research ───────────────────────────────────────────────────────
('Quanta Magazine',
 'https://www.quantamagazine.org',
 'https://api.quantamagazine.org/feed/',
 'rss', 'Science',
 array['science','math','physics','biology','research'],
 'The best science journalism anywhere. Covers mathematics, physics, biology, and computer science with depth.',
 10, 7, 10),

('r/science',
 'https://reddit.com/r/science',
 'https://www.reddit.com/r/science/.rss',
 'reddit', 'Science',
 array['science','research','studies','health','environment'],
 'Peer-reviewed science discussions. Good for catching important studies before mainstream media picks them up.',
 7, 10, 8),

('Nature News',
 'https://www.nature.com/news',
 'https://www.nature.com/nature.rss',
 'rss', 'Science',
 array['science','research','papers','health','climate'],
 'Breaking science news and research from one of the world''s leading scientific journals.',
 8, 9, 10),

-- ── Design & Product ─────────────────────────────────────────────────────────
('UX Collective',
 'https://uxdesign.cc',
 'https://uxdesign.cc/feed',
 'blog', 'Design',
 array['ux','design','product','user research','interfaces'],
 'Thoughtful essays on UX craft, design systems, and the practice of building useful things.',
 8, 8, 8),

('Figma Blog',
 'https://www.figma.com/blog',
 'https://www.figma.com/blog/rss.xml',
 'blog', 'Design',
 array['design','product','collaboration','tools','figma'],
 'Product design thinking and company-building from the team that redefined design tooling.',
 7, 7, 8),

('r/UXDesign',
 'https://reddit.com/r/UXDesign',
 'https://www.reddit.com/r/UXDesign/.rss',
 'reddit', 'Design',
 array['ux','ui','design','product','career'],
 'Portfolio feedback, career advice, and design debates from the UX practitioner community.',
 6, 10, 7),

-- ── Media & Journalism ───────────────────────────────────────────────────────
('Nieman Lab',
 'https://www.niemanlab.org',
 'https://www.niemanlab.org/feed/',
 'rss', 'Media',
 array['journalism','media','news industry','technology','business'],
 'Harvard''s journalism lab tracks the future of news — business models, technology, and editorial practice.',
 8, 8, 9),

-- ── Music ────────────────────────────────────────────────────────────────────
('Pitchfork',
 'https://pitchfork.com',
 'https://pitchfork.com/rss/news/feed.xml',
 'rss', 'Music',
 array['music','reviews','artists','culture','indie'],
 'The music world''s paper of record — reviews, news, and long-form features across all genres.',
 8, 9, 8),

('Bandcamp Daily',
 'https://daily.bandcamp.com',
 'https://daily.bandcamp.com/feed/',
 'rss', 'Music',
 array['music','independent','artists','discovery','culture'],
 'Artist profiles and curated listening guides from the platform that actually pays musicians fairly.',
 9, 8, 8),

('r/Music',
 'https://reddit.com/r/Music',
 'https://www.reddit.com/r/Music/.rss',
 'reddit', 'Music',
 array['music','discovery','artists','discussion','culture'],
 'A genuinely diverse music discovery community. Good for finding artists outside your algorithm.',
 6, 10, 7);
