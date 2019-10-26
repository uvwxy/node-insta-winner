# insta-winner

Randomly select winners of a giveaway from the comments matching a regex.

## Build

```
npm install
npm run compile
```

## General usage

```
node bin/main.js <url> <numWinners> <regex1> <regex2>
```

## Example
The following selects one winner that has tagged three friends and has mentioned `me luck`:

```
node bin/main.js "B3-IcuPI_2Q" 1 ".*@.+@.+@.+.*" ".*me luck.*"
```