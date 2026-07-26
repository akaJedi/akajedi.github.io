PRAGMA foreign_keys = ON;

CREATE TABLE route_daily_counts (
  date TEXT NOT NULL,
  route TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, route)
);
