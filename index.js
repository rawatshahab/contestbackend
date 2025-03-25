const express  = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

app.use(express.json());
const mongoose = require("mongoose");
mongoose.connect("mongodb+srv://mayank2402:Qwe%401234@collegeproject.hu9lxtu.mongodb.net/?retryWrites=true&w=majority&appName=CollegeProject", { useNewUrlParser: true, useUnifiedTopology: true });
const Bookmark = mongoose.model("Bookmark", new mongoose.Schema({
  name: String,
  site: String,
  startTime: String,
  duration: Number,
  url: String
}));


const YOUTUBE_API_KEY = "AIzaSyDix15O0tdo7kwdUguzabq_faCDxDaWkTs"; 

const PLAYLISTS = {
    Codeforces: "PLcXpkI9A-RZLUfBSNp-YQBCOezZKbDSgB",
    LeetCode: "PLcXpkI9A-RZI6FhydNz3JBt_-p_i25Cbr",
    CodeChef: "PLcXpkI9A-RZIZ6lsE0KCcLWeKNoG45fYr"
};

const fetchLeetcodeContests = async () => {
    try {
        const graphqlQuery = {
            query: `
                query getContestList {
                    allContests {
                        title
                        startTime
                        duration
                        titleSlug
                    }
                }
            `
        };

        const response = await axios.post('https://leetcode.com/graphql', graphqlQuery, {
            headers: { 'Content-Type': 'application/json' }
        });

        const allContests = response.data.data.allContests;
        const now = Date.now();

        const upcomingContests = allContests
            .filter(contest => contest.startTime * 1000 > now)
            .map(contest => ({
                site: 'LeetCode',
                name: contest.title,
                startTime: new Date(contest.startTime * 1000),
                duration: contest.duration,
                url: `https://leetcode.com/contest/${contest.titleSlug}`
            }));

        const previousContests = allContests
            .filter(contest => contest.startTime * 1000 < now)
            .sort((a, b) => b.startTime - a.startTime) 
            .slice(0, 10) 
            .map(contest => ({
                site: 'LeetCode',
                name: contest.title,
                startTime: new Date(contest.startTime * 1000),
                duration: contest.duration,
                url: `https://leetcode.com/contest/${contest.titleSlug}`
            }));

        return { upcomingContests, previousContests };
    } catch (error) {
        console.error('Error fetching LeetCode contests:', error.message);
        return { upcomingContests: [], previousContests: [] };
    }
};

const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) {
        console.error("Missing start or end date:", { startDate, endDate });
        return 0; 
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error(`Invalid date format: start=${startDate}, end=${endDate}`);
        return 0;
    }

    return Math.floor((end - start) / 1000); 
};

const fetchCodechefContests = async () => {
    try {
        const response = await axios.get('https://www.codechef.com/api/list/contests/all');

        if (!response.data.future_contests || !response.data.past_contests) {
            throw new Error('Failed to fetch CodeChef contests');
        }

        const upcomingContests = response.data.future_contests.map(contest => ({
            site: 'CodeChef',
            name: contest.contest_name,
            startTime: new Date(contest.contest_start_date).toISOString(),
            duration: calculateDuration(contest.contest_start_date, contest.contest_end_date), 
            url: `https://www.codechef.com/${contest.contest_code}`
        }));

        const previousContests = response.data.past_contests
            .sort((a, b) => new Date(b.contest_start_date) - new Date(a.contest_start_date)) 
            .slice(0, 10) 
            .map(contest => ({
                site: 'CodeChef',
                name: contest.contest_name,
                startTime: new Date(contest.contest_start_date),
                duration: calculateDuration(contest.contest_start_date, contest.contest_end_date), 
                url: `https://www.codechef.com/${contest.contest_code}`
            }));

        return { upcomingContests, previousContests };
    } catch (error) {
        console.error('Error fetching CodeChef contests:', error.message);
        return { upcomingContests: [], previousContests: [] };
    }
};

const fetchYouTubeSolutions = async () => {
    try {
        let allSolutions = [];

        for (const [platform, playlistId] of Object.entries(PLAYLISTS)) {
            const response = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
                params: {
                    part: "snippet",
                    maxResults: 20,
                    playlistId,
                    key: YOUTUBE_API_KEY
                }
            });

            const platformSolutions = response.data.items.map(video => ({
                title: video.snippet.title,
                url: `https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`,
                thumbnail: video.snippet.thumbnails.medium.url,
                platform
            }));

            allSolutions = [...allSolutions, ...platformSolutions];
        }

        return allSolutions;
    } catch (error) {
        console.error("Error fetching YouTube solutions:", error.message);
        return [];
    }
};


app.post("/api/bookmark", async (req, res) => {
    try {
        const { name, site, startTime, duration, url } = req.body;
        const existingBookmark = await Bookmark.findOne({ name, site });

        if (existingBookmark) {
            await Bookmark.deleteOne({ name, site });
            return res.status(200).json({ message: "Bookmark removed" });
        }

        const newBookmark = new Bookmark({ name, site, startTime, duration, url });
        await newBookmark.save();
        res.status(201).json({ message: "Bookmark saved" });
    } catch (error) {
        res.status(500).json({ error: "Failed to toggle bookmark" });
    }
});

app.get("/api/bookmarks", async (req, res) => {
    try {
        const bookmarks = await Bookmark.find();
        res.json(bookmarks);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
});

const fetchCodeforcesContests = async () => {
  try {
      const response = await axios.get("https://codeforces.com/api/contest.list?gym=false");
      const contests = response.data.result;

      const upcomingContests = contests
          .filter(contest => contest.phase === "BEFORE")
          .map(contest => ({
              site: "Codeforces",
              name: contest.name,
              startTime: new Date(contest.startTimeSeconds * 1000),
              duration: contest.durationSeconds,
              url: `https://codeforces.com/contest/${contest.id}`
          }));

      const previousContests = contests
          .filter(contest => contest.phase === "FINISHED")
          .sort((a, b) => b.startTimeSeconds - a.startTimeSeconds) 
          .slice(0, 10) 
          .map(contest => ({
              site: "Codeforces",
              name: contest.name,
              startTime: new Date(contest.startTimeSeconds * 1000),
              duration: contest.durationSeconds,
              url: `https://codeforces.com/contest/${contest.id}`
          }));

      return { upcomingContests, previousContests };
  } catch (error) {
      console.error("Error fetching Codeforces contests:", error);
      return { upcomingContests: [], previousContests: [] };
  }
};

app.get("/api/all-contests", async (req, res) => {
    try {
        const codeforces = await fetchCodeforcesContests();
        const leetcode = await fetchLeetcodeContests();
        const codechef = await fetchCodechefContests();

        res.json({
            upcomingContests: [...codeforces.upcomingContests, ...leetcode.upcomingContests, ...codechef.upcomingContests],
            previousContests: [...codeforces.previousContests, ...leetcode.previousContests, ...codechef.previousContests]
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch contests" });
    }
});

app.get("/api/solutions", async (req, res) => {
    try {
        const solutions = await fetchYouTubeSolutions();
        res.json(solutions);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch YouTube solutions" });
    }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});