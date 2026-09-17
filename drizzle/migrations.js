// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import m0000 from './20260916073702_careful_ghost_rider/migration.sql';
import m0001 from './20260916080849_polite_nightcrawler/migration.sql';
import m0002 from './20260917085443_plain_cannonball/migration.sql';

  export default {
    journal: {
      entries: [
        {
          idx: 0,
          when: 1789537022000,
          tag: '20260916073702_careful_ghost_rider',
          breakpoints: true,
        },
        {
          idx: 1,
          when: 1789538929000,
          tag: '20260916080849_polite_nightcrawler',
          breakpoints: true,
        },
        {
          idx: 2,
          when: 1789635283000,
          tag: '20260917085443_plain_cannonball',
          breakpoints: true,
        },
      ],
    },
    migrations: {
      "20260916073702_careful_ghost_rider": m0000,
"20260916080849_polite_nightcrawler": m0001,
"20260917085443_plain_cannonball": m0002
}
  }
  
