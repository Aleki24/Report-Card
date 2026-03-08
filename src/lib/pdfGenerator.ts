import puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

export interface ReportCardData {
    schoolName: string;
    examTitle: string;
    academicYear: string;
    studentName: string;
    enrollmentNumber: string;
    className: string;
    subjectMarks: {
        subjectName: string;
        score: number;
        totalPossible: number;
        percentage: number;
        grade: string;
        gradeBase: string; // Just the letter for color coding (A, B, C...)
        remarks: string;
    }[];
    overallPercentage: number;
    gpa: number;
    classRank: number;
    totalStudents: number;
    actionableFeedback: string;
}

/**
 * 1. Reads the Handlebars template
 * 2. Compiles it with the provided data
 * 3. Uses Puppeteer to generate a PDF buffer
 */
export async function generateStudentReportCardPDF(data: ReportCardData): Promise<Buffer> {
    // Read template. In Next.js, process.cwd() is the root of the project.
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'reportCard.hbs');
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    // Compile Handlebars
    const template = handlebars.compile(templateHtml);
    const finalHtml = template(data);

    // Launch Puppeteer 
    // Note: For production deployments (e.g. Vercel), you would typically use @sparticuz/chromium 
    // along with puppeteer-core to stay within serverless function limits. 
    // For local development, standard puppeteer is fine.
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set the HTML content
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        }
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
}
