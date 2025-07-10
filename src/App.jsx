import React, { useState, useEffect } from 'react';
import { Music, Heart, Shuffle, Play, User, LogOut, Loader2 } from 'lucide-react';

const SpotifyGenreOrganizer = () => {
  const [user, setUser] = useState(null);
  const [likedSongs, setLikedSongs] = useState([]);
  const [genrePlaylists, setGenrePlaylists] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const [error, setError] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Spotify API configuration
  const CLIENT_ID = 'abd78870df7945eeab6c97299e25815d';
  const CLIENT_SECRET = 'f35b8fef7c414dffa30f1199cc38ed00';
  const REDIRECT_URI = 'https://bitmorph.net/callback';
  const SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'playlist-modify-public',
    'playlist-modify-private'
  ].join(' ');

  // AI Genre Classification (Mock implementation)
  const classifyGenre = async (track) => {
    // In a real implementation, this would use audio features and ML
    const genres = ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'R&B', 'Indie', 'Alternative'];
    
    // Simple mock classification based on track features
    const mockFeatures = {
      danceability: Math.random(),
      energy: Math.random(),
      valence: Math.random(),
      acousticness: Math.random()
    };

    let genre = 'Pop'; // default
    
    if (mockFeatures.energy > 0.8 && mockFeatures.danceability > 0.7) {
      genre = 'Electronic';
    } else if (mockFeatures.acousticness > 0.7) {
      genre = 'Indie';
    } else if (mockFeatures.energy > 0.7) {
      genre = 'Rock';
    } else if (mockFeatures.danceability > 0.8) {
      genre = 'Hip-Hop';
    } else if (mockFeatures.valence < 0.3) {
      genre = 'Alternative';
    }

    return genre;
  };

  // Handle authorization callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      setError(`Authorization failed: ${error}`);
      return;
    }
    
    if (code && !accessToken) {
      exchangeCodeForToken(code);
    }
  }, []);

  const exchangeCodeForToken = async (code) => {
    try {
      setLoading(true);
      setProgress({ current: 0, total: 0, stage: 'Getting access token...' });
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(CLIENT_ID + ':' + CLIENT_SECRET)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get access token');
      }
      
      const data = await response.json();
      setAccessToken(data.access_token);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
    } catch (err) {
      setError('Failed to authenticate with Spotify');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile
  useEffect(() => {
    if (accessToken) {
      fetchUserProfile();
    }
  }, [accessToken]);

  const handleLogin = () => {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('spotify_auth_state', state);
    
    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state: state
    })}`;
    
    window.location.href = authUrl;
  };

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      setError('Failed to fetch user profile');
    }
  };

  const fetchLikedSongs = async () => {
    setLoading(true);
    setProgress({ current: 0, total: 0, stage: 'Fetching liked songs...' });
    
    try {
      const songs = [];
      let url = 'https://api.spotify.com/v1/me/tracks?limit=50';
      
      while (url) {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        
        songs.push(...data.items);
        setProgress({ current: songs.length, total: data.total, stage: 'Fetching liked songs...' });
        
        url = data.next;
      }
      
      setLikedSongs(songs);
    } catch (err) {
      setError('Failed to fetch liked songs');
    } finally {
      setLoading(false);
    }
  };

  const organizeByGenre = async () => {
    setLoading(true);
    setProgress({ current: 0, total: likedSongs.length, stage: 'Analyzing genres...' });
    
    const genreGroups = {};
    
    for (let i = 0; i < likedSongs.length; i++) {
      const song = likedSongs[i];
      const genre = await classifyGenre(song.track);
      
      if (!genreGroups[genre]) {
        genreGroups[genre] = [];
      }
      genreGroups[genre].push(song);
      
      setProgress({ current: i + 1, total: likedSongs.length, stage: 'Analyzing genres...' });
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    setGenrePlaylists(genreGroups);
    setLoading(false);
  };

  const createPlaylist = async (genre, tracks) => {
    try {
      setProgress({ current: 0, total: 0, stage: `Creating ${genre} playlist...` });
      
      // Create playlist
      const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `AI Generated - ${genre}`,
          description: `Auto-generated ${genre} playlist from your liked songs`,
          public: false
        })
      });
      
      const playlist = await playlistResponse.json();
      
      // Add tracks to playlist (Spotify API accepts max 100 tracks per request)
      const trackUris = tracks.map(track => track.track.uri);
      const chunks = [];
      for (let i = 0; i < trackUris.length; i += 100) {
        chunks.push(trackUris.slice(i, i + 100));
      }
      
      for (const chunk of chunks) {
        await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uris: chunk })
        });
      }
      
      return playlist;
    } catch (err) {
      throw new Error(`Failed to create ${genre} playlist`);
    }
  };

  const createAllPlaylists = async () => {
    setLoading(true);
    const genres = Object.keys(genrePlaylists);
    
    for (let i = 0; i < genres.length; i++) {
      const genre = genres[i];
      try {
        await createPlaylist(genre, genrePlaylists[genre]);
        setProgress({ current: i + 1, total: genres.length, stage: `Created ${genre} playlist` });
      } catch (err) {
        setError(`Failed to create ${genre} playlist`);
      }
    }
    
    setLoading(false);
    setError('All playlists created successfully!');
  };

  const handleLogout = () => {
    setUser(null);
    setAccessToken('');
    setLikedSongs([]);
    setGenrePlaylists({});
    setError('');
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-green-900 flex items-center justify-center">
        <div className="text-center space-y-8 p-8">
          <div className="flex items-center justify-center space-x-4">
            <Music className="w-16 h-16 text-green-400" />
            <h1 className="text-4xl font-bold text-white">Spotify Genre Organizer</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-md mx-auto">
            Organize your liked songs into AI-generated genre playlists automatically
          </p>
          <button
            onClick={handleLogin}
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-semibold transition-colors duration-200 flex items-center space-x-2 mx-auto"
          >
            <Music className="w-5 h-5" />
            <span>Connect with Spotify</span>
          </button>
            <div className="text-sm text-gray-400 max-w-md mx-auto">
              <p className="mb-4">⚠️ This is a demo application. To use it:</p>
              <ol className="text-left space-y-2">
                <li>1. Create a Spotify app at developer.spotify.com</li>
                <li>2. Replace CLIENT_ID and CLIENT_SECRET with your app's credentials</li>
                <li>3. Add {window.location.origin}/callback to redirect URIs</li>
                <li>4. The AI genre classification is currently mocked</li>
                <li>5. For production, handle the token exchange on your backend</li>
              </ol>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-black to-green-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <Music className="w-8 h-8 text-green-400" />
            <h1 className="text-2xl font-bold">Genre Organizer</h1>
          </div>
          {user && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>{user.display_name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        {loading && (
          <div className="mb-8 bg-gray-800 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Loader2 className="w-5 h-5 animate-spin text-green-400" />
              <span className="text-lg">{progress.stage}</span>
            </div>
            {progress.total > 0 && (
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            )}
            {progress.total > 0 && (
              <div className="text-sm text-gray-400 mt-2">
                {progress.current} / {progress.total}
              </div>
            )}
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className={`mb-8 p-4 rounded-lg ${
            error.includes('success') ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'
          }`}>
            {error}
          </div>
        )}

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <button
            onClick={fetchLikedSongs}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 p-6 rounded-lg flex flex-col items-center space-y-3 transition-colors"
          >
            <Heart className="w-8 h-8" />
            <span className="text-lg font-semibold">Fetch Liked Songs</span>
            <span className="text-sm opacity-80">
              {likedSongs.length > 0 ? `${likedSongs.length} songs loaded` : 'Load your music'}
            </span>
          </button>

          <button
            onClick={organizeByGenre}
            disabled={loading || likedSongs.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 p-6 rounded-lg flex flex-col items-center space-y-3 transition-colors"
          >
            <Shuffle className="w-8 h-8" />
            <span className="text-lg font-semibold">Analyze Genres</span>
            <span className="text-sm opacity-80">
              {Object.keys(genrePlaylists).length > 0 
                ? `${Object.keys(genrePlaylists).length} genres found` 
                : 'AI-powered classification'}
            </span>
          </button>

          <button
            onClick={createAllPlaylists}
            disabled={loading || Object.keys(genrePlaylists).length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 p-6 rounded-lg flex flex-col items-center space-y-3 transition-colors"
          >
            <Play className="w-8 h-8" />
            <span className="text-lg font-semibold">Create Playlists</span>
            <span className="text-sm opacity-80">Generate in Spotify</span>
          </button>
        </div>

        {/* Genre Playlists Preview */}
        {Object.keys(genrePlaylists).length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4">Genre Analysis Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(genrePlaylists).map(([genre, tracks]) => (
                <div key={genre} className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2 text-green-400">{genre}</h3>
                  <p className="text-gray-400 mb-3">{tracks.length} songs</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {tracks.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="font-medium">{item.track.name}</div>
                        <div className="text-gray-500">{item.track.artists[0].name}</div>
                      </div>
                    ))}
                    {tracks.length > 5 && (
                      <div className="text-sm text-gray-500">
                        +{tracks.length - 5} more songs
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyGenreOrganizer;