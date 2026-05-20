const fs = require('fs');
const file = 'src/pages/HomeLobby.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<span\s+className="absolute -top-1 -right-1 min-w-\[10px\] h-2\.5 rounded-full bg-green-300 border-2 border-\[#111\] animate-pulse"\s+aria-hidden\s+\/>/;

const replacement = `<>
                <span className="absolute -top-1 -right-1 flex h-[20px] min-w-[20px] animate-ping rounded-full bg-[#f65357] opacity-75" />
                <span className="absolute -top-1 -right-1 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#f65357] px-1 text-[11px] font-black text-white ring-2 ring-[#111]">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              </>`;

content = content.replace(regex, replacement);

const buttonRegex = /<button\s+onClick=\{\(\) => navigate\("\/social"\)\}\s+className="relative"/;
const buttonReplacement = `<button
            onClick={() => navigate("/social")}
            className="relative p-1 active:scale-95 transition-transform"`;

content = content.replace(buttonRegex, buttonReplacement);

fs.writeFileSync(file, content);
console.log('done');
