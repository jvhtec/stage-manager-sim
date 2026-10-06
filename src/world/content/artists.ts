/**
 * Real-world touring artists and their (approximate, for flavour) career arcs.
 *
 * `career` is a list of [year, tier] breakpoints: from that year on, the act
 * books rooms of that venue tier (1 pub/hall, 2 club/theatre, 3 arena,
 * 4 stadium) until the next breakpoint. Tier 0 = not touring (split, hiatus,
 * retired). Before the first breakpoint the act doesn't exist yet.
 *
 * Acts without a `country` tour everywhere; local acts only in their home
 * country's games (and come up more often there).
 *
 * Edit freely — the game only reads names, years and tiers.
 */
import type { CountryCode } from './countries';
export interface Artist {
  name: string;
  genre: string;
  career: [number, number][];
  /** Home-market act: only tours (on this map) in this country. Unset = tours everywhere. */
  country?: CountryCode;
}

export const ARTISTS: Artist[] = [
  // Already stadium-sized in 1990
  { name: 'The Rolling Stones', genre: 'Rock', career: [[1990, 4]] },
  { name: 'U2', genre: 'Rock', career: [[1990, 4]] },
  { name: 'Madonna', genre: 'Pop', career: [[1990, 4]] },
  { name: 'Michael Jackson', genre: 'Pop', career: [[1990, 4], [1998, 0]] },
  { name: 'Pink Floyd', genre: 'Rock', career: [[1990, 4], [1995, 0]] },
  { name: 'Bon Jovi', genre: 'Rock', career: [[1990, 4]] },
  { name: 'AC/DC', genre: 'Rock', career: [[1990, 4]] },
  { name: 'Bruce Springsteen', genre: 'Rock', career: [[1990, 4]] },
  { name: 'Elton John', genre: 'Pop', career: [[1990, 4], [2024, 0]] },
  { name: 'Tina Turner', genre: 'Pop', career: [[1990, 4], [2001, 0], [2008, 4], [2010, 0]] },
  { name: 'David Bowie', genre: 'Rock', career: [[1990, 4], [2004, 0]] },
  { name: "Guns N' Roses", genre: 'Rock', career: [[1990, 4], [1994, 0], [2016, 4]] },
  { name: 'Genesis', genre: 'Rock', career: [[1990, 4], [1993, 0], [2007, 4], [2008, 0], [2021, 4], [2022, 0]] },
  { name: 'Depeche Mode', genre: 'Synth-pop', career: [[1990, 4], [1994, 3], [2006, 4]] },

  // Arena acts in 1990
  { name: 'Metallica', genre: 'Metal', career: [[1990, 3], [1992, 4]] },
  { name: 'Prince', genre: 'Funk', career: [[1990, 3], [2016, 0]] },
  { name: 'Simple Minds', genre: 'Rock', career: [[1990, 4], [1996, 3]] },
  { name: 'The Cure', genre: 'Alternative', career: [[1990, 3]] },
  { name: 'Iron Maiden', genre: 'Metal', career: [[1990, 3], [2008, 4]] },
  { name: 'Kylie Minogue', genre: 'Pop', career: [[1990, 3]] },
  { name: 'The Stone Roses', genre: 'Indie', career: [[1990, 3], [1996, 0], [2012, 4], [2017, 0]] , country: 'GB' },
  { name: 'Queen', genre: 'Rock', career: [[2005, 4]] },
  { name: 'Red Hot Chili Peppers', genre: 'Rock', career: [[1990, 2], [1992, 3], [2004, 4]] },
  { name: 'R.E.M.', genre: 'Alternative', career: [[1990, 2], [1991, 3], [1995, 4], [2008, 3], [2011, 0]] },

  // Breaking through in the 90s
  { name: 'Nirvana', genre: 'Grunge', career: [[1990, 1], [1991, 2], [1992, 3], [1994, 0]] },
  { name: 'Pearl Jam', genre: 'Grunge', career: [[1991, 2], [1992, 3]] },
  { name: 'Blur', genre: 'Britpop', career: [[1990, 2], [1994, 3], [2004, 0], [2009, 4], [2010, 0], [2023, 4], [2024, 0]] },
  { name: 'Oasis', genre: 'Britpop', career: [[1993, 1], [1994, 2], [1995, 3], [1996, 4], [2009, 0], [2025, 4]] },
  { name: 'Pulp', genre: 'Britpop', career: [[1990, 1], [1994, 2], [1995, 3], [2002, 0], [2011, 3], [2012, 0], [2023, 3]] , country: 'GB' },
  { name: 'Radiohead', genre: 'Alternative', career: [[1992, 1], [1994, 2], [1997, 3], [2008, 4], [2019, 0]] },
  { name: 'Manic Street Preachers', genre: 'Rock', career: [[1990, 1], [1992, 2], [1997, 3]] , country: 'GB' },
  { name: 'Massive Attack', genre: 'Trip-hop', career: [[1991, 2], [1998, 3]] },
  { name: 'The Prodigy', genre: 'Electronic', career: [[1991, 1], [1993, 2], [1997, 3], [2019, 0]] },
  { name: 'Take That', genre: 'Pop', career: [[1991, 2], [1993, 3], [1996, 0], [2006, 4]] , country: 'GB' },
  { name: 'Green Day', genre: 'Punk', career: [[1990, 1], [1994, 2], [1995, 3], [2005, 4]] },
  { name: 'Foo Fighters', genre: 'Rock', career: [[1995, 2], [1999, 3], [2006, 4]] },
  { name: 'Spice Girls', genre: 'Pop', career: [[1997, 3], [1998, 4], [1999, 0], [2007, 3], [2008, 0], [2019, 4], [2020, 0]] },
  { name: 'Robbie Williams', genre: 'Pop', career: [[1997, 2], [1998, 3], [2001, 4]] },
  { name: 'Daft Punk', genre: 'Electronic', career: [[1996, 1], [1997, 2], [2006, 3], [2008, 0]] },
  { name: 'Fatboy Slim', genre: 'Electronic', career: [[1996, 1], [1998, 3]] },
  { name: 'Muse', genre: 'Rock', career: [[1998, 1], [2000, 2], [2004, 3], [2007, 4]] },
  { name: 'Coldplay', genre: 'Pop-rock', career: [[1998, 1], [2000, 2], [2002, 3], [2005, 4]] },
  { name: 'Westlife', genre: 'Pop', career: [[1999, 3], [2012, 0], [2019, 3]] },
  { name: 'Travis', genre: 'Indie', career: [[1996, 1], [1997, 2], [1999, 3], [2004, 2]] , country: 'GB' },
  { name: 'Super Furry Animals', genre: 'Indie', career: [[1995, 1], [1996, 2], [2010, 0]] , country: 'GB' },

  // The 2000s
  { name: 'The Strokes', genre: 'Indie', career: [[2001, 2], [2004, 3]] },
  { name: 'The White Stripes', genre: 'Garage rock', career: [[2000, 1], [2002, 2], [2005, 3], [2011, 0]] },
  { name: 'Linkin Park', genre: 'Nu-metal', career: [[2000, 2], [2001, 3], [2007, 4], [2017, 0], [2024, 4]] },
  { name: 'Beyoncé', genre: 'R&B', career: [[2003, 3], [2013, 4]] },
  { name: 'The Killers', genre: 'Indie', career: [[2004, 2], [2005, 3], [2017, 4]] },
  { name: 'Franz Ferdinand', genre: 'Indie', career: [[2003, 1], [2004, 2], [2005, 3], [2009, 2]] },
  { name: 'Kings of Leon', genre: 'Rock', career: [[2003, 2], [2008, 3], [2009, 4], [2017, 3]] },
  { name: 'Arctic Monkeys', genre: 'Indie', career: [[2005, 1], [2006, 3], [2014, 4]] },
  { name: 'Kaiser Chiefs', genre: 'Indie', career: [[2004, 2], [2005, 3], [2010, 2]] , country: 'GB' },
  { name: 'Amy Winehouse', genre: 'Soul', career: [[2003, 1], [2004, 2], [2007, 3], [2011, 0]] },
  { name: 'Lady Gaga', genre: 'Pop', career: [[2008, 2], [2009, 3], [2011, 4]] },
  { name: 'Rihanna', genre: 'Pop', career: [[2006, 3], [2016, 4], [2017, 0]] },
  { name: 'Taylor Swift', genre: 'Pop', career: [[2006, 2], [2009, 3], [2013, 4]] },
  { name: 'Florence + the Machine', genre: 'Indie', career: [[2008, 1], [2009, 2], [2011, 3]] },
  { name: 'Adele', genre: 'Soul', career: [[2007, 1], [2008, 2], [2011, 3], [2016, 4], [2017, 0], [2022, 4]] },

  // The 2010s and beyond
  { name: 'Ed Sheeran', genre: 'Pop', career: [[2010, 1], [2012, 2], [2014, 3], [2015, 4]] },
  { name: 'One Direction', genre: 'Pop', career: [[2011, 3], [2013, 4], [2016, 0]] },
  { name: 'Bruno Mars', genre: 'Pop', career: [[2010, 2], [2011, 3], [2017, 4]] },
  { name: 'The 1975', genre: 'Pop-rock', career: [[2012, 1], [2013, 2], [2016, 3]] },
  { name: 'The Weeknd', genre: 'R&B', career: [[2012, 2], [2015, 3], [2022, 4]] },
  { name: 'Stormzy', genre: 'Grime', career: [[2014, 1], [2016, 2], [2019, 3]] , country: 'GB' },
  { name: 'Dua Lipa', genre: 'Pop', career: [[2015, 1], [2016, 2], [2018, 3], [2024, 4]] },
  { name: 'Harry Styles', genre: 'Pop', career: [[2017, 3], [2022, 4]] },
  { name: 'Billie Eilish', genre: 'Pop', career: [[2017, 1], [2018, 2], [2019, 3], [2025, 4]] },
  { name: 'Fontaines D.C.', genre: 'Post-punk', career: [[2018, 1], [2019, 2], [2024, 3]] },
  { name: 'Wet Leg', genre: 'Indie', career: [[2021, 1], [2022, 2]] , country: 'GB' },
  { name: 'Sabrina Carpenter', genre: 'Pop', career: [[2018, 2], [2024, 3]] },

  // España
  { name: 'Héroes del Silencio', genre: 'Rock', country: 'ES', career: [[1990, 3], [1996, 0], [2007, 4], [2008, 0]] },
  { name: 'Mecano', genre: 'Pop', country: 'ES', career: [[1990, 3], [1993, 0]] },
  { name: 'Joaquín Sabina', genre: 'Cantautor', country: 'ES', career: [[1990, 3]] },
  { name: 'Duncan Dhu', genre: 'Pop-rock', country: 'ES', career: [[1990, 2], [2001, 0]] },
  { name: 'Los Secretos', genre: 'Pop-rock', country: 'ES', career: [[1990, 2]] },
  { name: 'Extremoduro', genre: 'Rock', country: 'ES', career: [[1990, 1], [1996, 2], [2002, 3], [2020, 0]] },
  { name: 'Alejandro Sanz', genre: 'Pop', country: 'ES', career: [[1991, 2], [1997, 3], [2019, 4]] },
  { name: 'Bunbury', genre: 'Rock', country: 'ES', career: [[1997, 2], [2004, 3]] },
  { name: 'Manolo García', genre: 'Pop-rock', country: 'ES', career: [[1998, 2], [2001, 3]] },
  { name: 'Fito & Fitipaldis', genre: 'Rock', country: 'ES', career: [[1998, 1], [2001, 2], [2006, 3]] },
  { name: 'La Oreja de Van Gogh', genre: 'Pop', country: 'ES', career: [[1998, 2], [2000, 3]] },
  { name: 'Estopa', genre: 'Rumba-rock', country: 'ES', career: [[1999, 2], [2000, 3]] },
  { name: 'Amaral', genre: 'Pop-rock', country: 'ES', career: [[1998, 1], [2000, 2], [2003, 3]] },
  { name: 'Marea', genre: 'Rock', country: 'ES', career: [[1999, 1], [2002, 2], [2007, 3]] },
  { name: 'El Canto del Loco', genre: 'Pop-rock', country: 'ES', career: [[2001, 2], [2005, 3], [2010, 0]] },
  { name: 'Pereza', genre: 'Rock', country: 'ES', career: [[2001, 1], [2005, 2], [2008, 3], [2011, 0]] },
  { name: 'Melendi', genre: 'Pop', country: 'ES', career: [[2003, 2], [2005, 3]] },
  { name: 'Love of Lesbian', genre: 'Indie', country: 'ES', career: [[2005, 1], [2009, 2], [2013, 3]] },
  { name: 'Vetusta Morla', genre: 'Indie', country: 'ES', career: [[2008, 1], [2010, 2], [2014, 3]] },
  { name: 'Leiva', genre: 'Rock', country: 'ES', career: [[2012, 2], [2016, 3]] },
  { name: 'Rosalía', genre: 'Pop / flamenco', country: 'ES', career: [[2017, 1], [2018, 2], [2019, 3]] },
  { name: 'C. Tangana', genre: 'Urban', country: 'ES', career: [[2017, 2], [2021, 3]] },
  { name: 'Aitana', genre: 'Pop', country: 'ES', career: [[2018, 2], [2019, 3]] },
  { name: 'Quevedo', genre: 'Urban', country: 'ES', career: [[2022, 3]] },
  { name: 'Lola Índigo', genre: 'Pop', country: 'ES', career: [[2018, 2], [2020, 3]] },

  // United States (home-market acts)
  { name: 'Garth Brooks', genre: 'Country', country: 'US', career: [[1990, 3], [1993, 4]] },
  { name: 'Grateful Dead', genre: 'Rock', country: 'US', career: [[1990, 4], [1995, 0]] },
  { name: 'Tom Petty & the Heartbreakers', genre: 'Rock', country: 'US', career: [[1990, 3], [2017, 0]] },
  { name: 'Phish', genre: 'Jam', country: 'US', career: [[1990, 2], [1994, 3]] },
  { name: 'Dave Matthews Band', genre: 'Rock', country: 'US', career: [[1994, 2], [1996, 3], [1999, 4]] },
  { name: 'Kenny Chesney', genre: 'Country', country: 'US', career: [[1995, 2], [2000, 3], [2005, 4]] },
  { name: 'Luke Combs', genre: 'Country', country: 'US', career: [[2017, 2], [2019, 3], [2022, 4]] },
  { name: 'Morgan Wallen', genre: 'Country', country: 'US', career: [[2018, 2], [2021, 3], [2023, 4]] },
  { name: 'Zach Bryan', genre: 'Country', country: 'US', career: [[2022, 2], [2023, 3], [2024, 4]] },

  // Deutschland
  { name: 'Die Toten Hosen', genre: 'Punk-rock', country: 'DE', career: [[1990, 3], [2012, 4]] },
  { name: 'Herbert Grönemeyer', genre: 'Pop-rock', country: 'DE', career: [[1990, 3], [2003, 4]] },
  { name: 'Peter Maffay', genre: 'Rock', country: 'DE', career: [[1990, 3]] },
  { name: 'Die Ärzte', genre: 'Punk-rock', country: 'DE', career: [[1993, 2], [1998, 3]] },
  { name: 'Rammstein', genre: 'Industrial', career: [[1995, 1], [1997, 2], [2001, 3], [2019, 4]] },
  { name: 'Sportfreunde Stiller', genre: 'Indie', country: 'DE', career: [[2002, 2], [2006, 3]] },
  { name: 'Seeed', genre: 'Dancehall', country: 'DE', career: [[2001, 2], [2006, 3]] },
  { name: 'Helene Fischer', genre: 'Schlager', country: 'DE', career: [[2007, 2], [2011, 3], [2015, 4]] },
  { name: 'Kraftklub', genre: 'Indie', country: 'DE', career: [[2011, 1], [2012, 2], [2017, 3]] },

  // France
  { name: 'Johnny Hallyday', genre: 'Rock', country: 'FR', career: [[1990, 4], [2017, 0]] },
  { name: 'Noir Désir', genre: 'Rock', country: 'FR', career: [[1990, 2], [1997, 3], [2003, 0]] },
  { name: 'Indochine', genre: 'New wave', country: 'FR', career: [[1990, 2], [2002, 3], [2010, 4]] },
  { name: 'Mylène Farmer', genre: 'Pop', country: 'FR', career: [[1996, 3], [2009, 4]] },
  { name: '-M-', genre: 'Pop-rock', country: 'FR', career: [[1999, 2], [2003, 3]] },
  { name: 'Orelsan', genre: 'Rap', country: 'FR', career: [[2009, 2], [2018, 3]] },
  { name: 'Christine and the Queens', genre: 'Pop', country: 'FR', career: [[2014, 2], [2016, 3]] },
  { name: 'Angèle', genre: 'Pop', country: 'FR', career: [[2018, 2], [2019, 3]] },
  { name: 'Ninho', genre: 'Rap', country: 'FR', career: [[2017, 2], [2021, 3]] },

  // Italia
  { name: 'Vasco Rossi', genre: 'Rock', country: 'IT', career: [[1990, 4]] },
  { name: 'Zucchero', genre: 'Blues-rock', country: 'IT', career: [[1990, 3]] },
  { name: 'Eros Ramazzotti', genre: 'Pop', career: [[1990, 3]] },
  { name: 'Jovanotti', genre: 'Pop', country: 'IT', career: [[1990, 2], [1994, 3], [2015, 4]] },
  { name: 'Ligabue', genre: 'Rock', country: 'IT', career: [[1991, 2], [1995, 3], [1997, 4]] },
  { name: 'Laura Pausini', genre: 'Pop', career: [[1993, 2], [1996, 3], [2007, 4]] },
  { name: 'Tiziano Ferro', genre: 'Pop', country: 'IT', career: [[2001, 2], [2004, 3], [2015, 4]] },
  { name: 'Cesare Cremonini', genre: 'Pop', country: 'IT', career: [[2000, 2], [2010, 3], [2018, 4]] },
  { name: 'Måneskin', genre: 'Rock', career: [[2017, 1], [2018, 2], [2021, 3], [2023, 4]] },
  { name: 'Ultimo', genre: 'Pop', country: 'IT', career: [[2018, 2], [2019, 3], [2022, 4]] },
];

/** The tier an artist tours at in `year`, or 0 if they aren't touring. */
export function artistTierIn(artist: Artist, year: number): number {
  let tier = 0;
  for (const [from, t] of artist.career) {
    if (year >= from) tier = t;
  }
  return tier;
}

export function artistsTouringAt(year: number, tier: number, country?: string): Artist[] {
  return ARTISTS.filter(a => artistTierIn(a, year) === tier && (!a.country || !country || a.country === country));
}

/** Home acts come up more often at home. */
export const homeWeight = (a: Artist) => (a.country ? 2 : 1);

export function findArtist(name: string): Artist | undefined {
  return ARTISTS.find(a => a.name === name);
}
