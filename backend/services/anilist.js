const ANILIST_URL = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
  query SearchAnime($search: String) {
    Page(perPage: 5) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english native }
        episodes
        status
        averageScore
        meanScore
        popularity
        favourites
        genres
        season
        seasonYear
        format
        duration
        description(asHtml: false)
        coverImage { large medium color }
        bannerImage
        studios(isMain: true) { nodes { name } }
        startDate { year month day }
        endDate { year month day }
        source
        tags { name rank isMediaSpoiler }
        rankings { rank type allTime season year context }
      }
    }
  }
`;

const GET_BY_ID_QUERY = `
  query GetAnime($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      episodes
      status
      averageScore
      meanScore
      popularity
      favourites
      genres
      season
      seasonYear
      format
      duration
      description(asHtml: false)
      coverImage { large medium color }
      bannerImage
      studios(isMain: true) { nodes { name } }
      startDate { year month day }
      endDate { year month day }
      source
      tags { name rank isMediaSpoiler }
      rankings { rank type allTime season year context }
    }
  }
`;

async function anilistRequest(query, variables) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export async function searchAnime(title) {
  const data = await anilistRequest(SEARCH_QUERY, { search: title });
  return data.Page.media;
}

export async function getAnimeById(id) {
  const data = await anilistRequest(GET_BY_ID_QUERY, { id });
  return data.Media;
}

export function formatAnimeData(media) {
  return {
    anilist_id: media.id,
    title_romaji: media.title.romaji,
    title_english: media.title.english,
    title_native: media.title.native,
    episodes: media.episodes,
    status: media.status,
    average_score: media.averageScore,
    mean_score: media.meanScore,
    popularity: media.popularity,
    favourites: media.favourites,
    genres: media.genres,
    season: media.season,
    season_year: media.seasonYear,
    format: media.format,
    duration: media.duration,
    description: media.description,
    cover_image_large: media.coverImage?.large,
    cover_image_medium: media.coverImage?.medium,
    cover_color: media.coverImage?.color,
    banner_image: media.bannerImage,
    studio: media.studios?.nodes?.[0]?.name,
    start_year: media.startDate?.year,
    tags: media.tags?.filter(t => !t.isMediaSpoiler).slice(0, 8).map(t => t.name),
    all_time_rank: media.rankings?.find(r => r.allTime && r.type === 'RATED')?.rank,
  };
}
