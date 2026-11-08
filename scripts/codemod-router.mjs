import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src/views', 'src/components'];
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
}
for (const r of roots) walk(r);

let changed = 0;
for (const file of files) {
  let s = readFileSync(file, 'utf8');
  const before = s;
  s = s.replace(/import \{ Link \} from 'react-router-dom';/g, "import Link from 'next/link';");
  s = s.replace(/import \{ Link, useNavigate \} from 'react-router-dom';/g, "import Link from 'next/link';\nimport { useRouter } from 'next/navigation';");
  s = s.replace(/import \{ useNavigate \} from 'react-router-dom';/g, "import { useRouter } from 'next/navigation';");
  s = s.replace(/import \{ Link, useParams \} from 'react-router-dom';/g, "import Link from 'next/link';\nimport { useParams } from 'next/navigation';");
  s = s.replace(/import \{ Link, useLocation \} from 'react-router-dom';/g, "import Link from 'next/link';\nimport { usePathname } from 'next/navigation';");
  s = s.replace(/const navigate = useNavigate\(\);/g, 'const router = useRouter();');
  s = s.replace(/\bnavigate\(/g, 'router.push(');
  s = s.replace(/<Link to=/g, '<Link href=');
  if (s !== before) {
    writeFileSync(file, s);
    changed++;
    console.log('updated', file);
  }
}
console.log(`\n${changed} files updated`);
