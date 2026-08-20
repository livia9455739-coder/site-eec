const htmlPattern = /<\/?[a-z][\s\S]*>/i
const dangerousPattern = /<\s*script|on[a-z]+\s*=|javascript\s*:|<\s*(iframe|object|embed|svg|link|meta)/i

export function hasSuspiciousHtml(value: string): boolean {
    return dangerousPattern.test(value) || htmlPattern.test(value)
}

export function sanitizeText(value: string): string {
    return value
        .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
        .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '')
        .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript\s*:/gi, '')
        .trim()
}
