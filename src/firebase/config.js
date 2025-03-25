import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyB95tnt1BHAvsiLDxc1aLnexOBLRK9RH0U",
  authDomain: "external-database-651a3.firebaseapp.com",
  projectId: "external-database-651a3",
  storageBucket: "external-database-651a3.firebasestorage.app",
  messagingSenderId: "768078709169",
  appId: "1:768078709169:web:b4e8ef3341295c5eeefd90",
  measurementId: "G-9XKS58406L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase Storage instance
const storage = getStorage(app);

export { storage }; 