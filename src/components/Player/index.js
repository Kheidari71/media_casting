import Player from './Player';
import HLSPlayer from './HLSPlayer';

// You can control which player to use with an environment variable or configuration
const USE_HLS = process.env.REACT_APP_USE_HLS === 'true';

// Export the appropriate player
export default USE_HLS ? HLSPlayer : Player;