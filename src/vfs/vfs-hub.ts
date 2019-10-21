import { VFS } from '../vfs';

interface Root {
  [dirname: string]: () => VFS;
}

export default class HubFS implements VFS {
  constructor(private root: Root) {

  }

  async invoke(fsop: keyof VFS, path: string, ...args) {
    if (!path.startsWith('/'))
      throw new Error('Bad path: ' + path);
    if (path == '/' && fsop == 'dir')
      return Object.keys(this.root);
    let i = path.indexOf('/', 1);
    if (i < 0) i = path.length;
    let name = path.slice(1, i);
    let fsget = this.root[name];
    if (!fsget)
      throw new Error('Bad path: ' + path);
    let fs = fsget();
    let handler = fs[fsop];
    if (!fs[fsop] && !fs.invoke)
      throw new Error('Not supported: ' + fsop + ' on ' + path);
    let rel = path.slice(i) || '/';
    return fs[fsop] ?
      (fs[fsop] as any)(rel, ...args) :
      fs.invoke(fsop, rel, ...args);
  }
}
