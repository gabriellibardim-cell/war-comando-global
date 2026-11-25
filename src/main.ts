import './styles.css';
import { WarApp } from './ui/app.ts';

const root = document.getElementById('app');
if (root) {
  new WarApp(root);
}
