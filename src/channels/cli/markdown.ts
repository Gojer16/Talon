import { marked } from 'marked';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';

/**
 * Custom Marked Renderer for Terminal Output
 * Converts Markdown to ANSI escape codes for rich terminal display.
 */
class TerminalRenderer extends marked.Renderer {
    // ─── Text Styles ──────────────────────────────────────────────

    strong(text: string): string {
        return chalk.bold(text);
    }

    em(text: string): string {
        return chalk.italic(text);
    }

    codespan(text: string): string {
        return chalk.yellow(text);
    }

    br(): string {
        return '\n';
    }

    del(text: string): string {
        return chalk.strikethrough(text);
    }

    link(href: string, title: string | null | undefined, text: string): string {
        // OSC 8 hyperlink if supported, fallback to text (url)
        // For broad compatibility, we'll stick to text (url)
        // But let's verify if terminal supports hyperlinks? Safer to just show URL.
        const url = chalk.blue.underline(href);
        return `${text} (${url})`;
    }

    image(href: string, title: string | null | undefined, text: string): string {
        return `[Image: ${text || 'image'} - ${href}]`;
    }

    text(text: string): string {
        return text;
    }

    // ─── Block Elements ───────────────────────────────────────────

    heading(text: string, level: number): string {
        const content = text;
        const width = process.stdout.columns || 80;

        switch (level) {
            case 1:
                return `\n${chalk.bold.bgBlue.white(` ${content.toUpperCase()} `)}\n${chalk.blue('═'.repeat(width))}\n`;
            case 2:
                return `\n${chalk.bold.cyan(`## ${content}`)}\n${chalk.cyan('─'.repeat(content.length + 3))}\n`;
            case 3:
                return `\n${chalk.bold.green(`### ${content}`)}\n`;
            case 4:
                return `\n${chalk.bold.yellow(`#### ${content}`)}\n`;
            default:
                return `\n${chalk.bold(content)}\n`;
        }
    }

    code(code: string, language: string | undefined, isEscaped: boolean): string {
        const validLang = language || 'plaintext';
        let highlighted = code;

        try {
            // cli-highlight handles most languages
            highlighted = highlight(code, {
                language: validLang,
                ignoreIllegals: true,
                theme: {
                    keyword: chalk.blue,
                    built_in: chalk.cyan,
                    type: chalk.cyan.dim,
                    literal: chalk.magenta,
                    number: chalk.green,
                    regexp: chalk.red,
                    string: chalk.yellow,
                    subst: chalk.white.dim,
                    symbol: chalk.white,
                    class: chalk.blue,
                    function: chalk.yellow,
                    title: chalk.white.bold,
                    params: chalk.white,
                    comment: chalk.gray,
                    doctag: chalk.green,
                    meta: chalk.gray,
                    'meta-keyword': chalk.gray,
                    'meta-string': chalk.gray
                }
            });
        } catch (e) {
            // Fallback to plain text if highlighting fails
        }

        const width = process.stdout.columns || 80;
        const langLabel = language ? chalk.bgBlue.black(` ${language} `) : '';

        // Add a nice header if language is known
        const header = language ? `\n${langLabel}\n` : '\n';

        // Indent and add left border
        const lines = highlighted.split('\n').map(line => `${chalk.blue('│')} ${line}`).join('\n');

        return `${header}${lines}\n${chalk.blue('└')}─${chalk.gray('─'.repeat(10))}\n`;
    }

    blockquote(quote: string): string {
        const lines = quote.split('\n');
        return '\n' + lines.map(line => `${chalk.gray('▎')} ${line}`).join('\n') + '\n';
    }

    list(body: string, ordered: boolean, start: number): string {
        return `\n${body}\n`;
    }

    listitem(text: string): string {
        // We don't get 'ordered' here easily in v12 renderer without context, 
        // but typically bullet is fine.
        // For ordered lists, marked passes the number in the text? No.
        // Let's just use bullet for now.
        return `  ${chalk.cyan('•')} ${text}\n`;
    }

    hr(): string {
        const width = process.stdout.columns || 50;
        return `\n${chalk.gray('─'.repeat(width))}\n`;
    }

    paragraph(text: string): string {
        return `\n${text}\n`;
    }
    // ─── Table Support ────────────────────────────────────────────

    table(header: string, body: string): string {
        if (!header && !body) return '';

        // Helper to parse row string (which contains cells separated by <tc>)
        const parseRow = (rowStr: string): string[] => {
            if (!rowStr.trim()) return [];
            // implementation note: cell separator is " <tc> "
            return rowStr.split(' <tc> ').map(c => c.trim()).filter((c, i, arr) => {
                // The last one might be empty if split by separator at end
                if (i === arr.length - 1 && c === '') return false;
                return true;
            });
        };

        const headRowsLines = header.split('\n').filter(r => r.trim());
        const bodyRowsLines = body.split('\n').filter(r => r.trim());

        const headRows = headRowsLines.map(parseRow);
        const bodyRows = bodyRowsLines.map(parseRow);

        const allRows = [...headRows, ...bodyRows];
        if (allRows.length === 0) return '';

        // Calculate max width for each column
        // We assume rectangular table mostly
        const colWidths: number[] = [];

        // Simple ANSI strip regex
        const stripAnsi = (s: string) => s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

        allRows.forEach(row => {
            row.forEach((cell, i) => {
                const len = stripAnsi(cell).length;
                colWidths[i] = Math.max(colWidths[i] || 0, len);
            });
        });

        // Render Row
        const renderRow = (row: string[]) => {
            return ' ' + row.map((cell, i) => {
                const len = stripAnsi(cell).length;
                const pad = ' '.repeat((colWidths[i] || 0) - len);
                return cell + pad;
            }).join(chalk.gray(' │ ')) + ' '; // Padding around row
        };

        const headLine = headRows.map(row => renderRow(row)).join('\n');
        const bodyLine = bodyRows.map(row => renderRow(row)).join('\n');

        // Separators
        // e.g. ─┼─
        const lineSep = colWidths.map(w => '─'.repeat(w)).join(chalk.gray('─┼─'));
        const topSep = colWidths.map(w => '─'.repeat(w)).join(chalk.gray('─┬─'));
        const botSep = colWidths.map(w => '─'.repeat(w)).join(chalk.gray('─┴─'));

        let out = `\n${chalk.gray('┌─')}${topSep}${chalk.gray('─┐')}\n`;
        if (headLine) {
            out += `${headLine}\n`;
            out += `${chalk.gray('├─')}${lineSep}${chalk.gray('─┤')}\n`;
        }
        if (bodyLine) {
            out += `${bodyLine}\n`;
        }
        out += `${chalk.gray('└─')}${botSep}${chalk.gray('─┘')}\n`;

        return out;
    }

    tablerow(content: string): string {
        return content + '\n';
    }

    tablecell(content: string, flags: { header: boolean; align: 'center' | 'left' | 'right' | null }): string {
        return content + ' <tc> ';
    }
}

// Instantiate once
const terminalRenderer = new TerminalRenderer();

/**
 * Render Markdown string to ANSI-coded string for terminal display.
 */
export function renderMarkdown(text: string): string {
    // marked.parse returns Promise | string depending on async option. 
    // By default sync.
    return marked.parse(text, {
        renderer: terminalRenderer,
        gfm: true,
        breaks: true,
        async: false
    }) as string;
}
