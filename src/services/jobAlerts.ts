import '../env';
import prisma from './prisma';
import Groq from 'groq-sdk';

export const checkAndNotifyStudents = async (listingId: string): Promise<void> => {
  try {
    // 1. Get the new listing
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        employer: { select: { companyName: true } }
      }
    });

    if (!listing) return;

    // 2. Get all students with job alerts enabled and skills set
    const students = await prisma.student.findMany({
      where: {
        jobAlertsEnabled: true,
        skills: { not: null }
      },
      include: {
        user: { select: { id: true } }
      }
    });

    if (students.length === 0) return;

    console.log(`Checking ${students.length} students for job alert match...`);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // 3. Check each student against the new listing
    for (const student of students) {
      try {
        const aiResponse = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are an internship matching assistant. Respond with a single JSON object only.'
            },
            {
              role: 'user',
              content: `Student skills: ${student.skills}
              
Internship: ${listing.title} at ${listing.employer.companyName}
Skills needed: ${listing.skills || 'Not specified'}

Return ONLY this JSON:
{ "score": <number 0-100>, "match": <true if score >= 70, false otherwise> }`
            }
          ],
          max_tokens: 100,
        });

        const raw = aiResponse.choices[0]?.message?.content?.trim() || '{}';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleaned);

        // 4. If good match, create a notification
        if (result.match === true && result.score >= 70) {
          await prisma.notification.create({
            data: {
              userId: student.user.id,
              type: 'job_alert',
              message: `New internship match! "${listing.title}" at ${listing.employer.companyName} matches your skills with a ${result.score}% match score.`
            }
          });
          console.log(`✓ Notified student ${student.userId} — match score: ${result.score}`);
        }

      } catch (err) {
        console.warn(`Skipped student ${student.userId}:`, err);
      }
    }

  } catch (error) {
    console.error('checkAndNotifyStudents error:', error);
  }
};