import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FeedbackRequest {
  category: string
  rating?: number
  message: string
  email?: string
  userId: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check if API key is configured
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured. Please set RESEND_API_KEY in Supabase Edge Function secrets.',
          details: 'The email service requires a Resend API key to be configured.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const { category, rating, message, email, userId }: FeedbackRequest = await req.json()

    // Create email content
    const categoryEmoji = {
      bug: '🐛',
      feature: '💡',
      improvement: '✨',
      other: '💬',
    }[category] || '💬'

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007AFF; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #666; }
            .value { margin-top: 5px; }
            .rating { color: #FFC107; font-size: 20px; }
            .message-box { background: white; padding: 15px; border-left: 4px solid #007AFF; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${categoryEmoji} New Feedback - Swift Invoice</h2>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Category:</div>
                <div class="value">${category.toUpperCase()}</div>
              </div>
              
              ${rating ? `
                <div class="field">
                  <div class="label">Rating:</div>
                  <div class="value rating">${'⭐'.repeat(rating)} (${rating}/5)</div>
                </div>
              ` : ''}
              
              <div class="field">
                <div class="label">User Email:</div>
                <div class="value">${email || 'Not provided'}</div>
              </div>
              
              <div class="field">
                <div class="label">User ID:</div>
                <div class="value">${userId}</div>
              </div>
              
              <div class="field">
                <div class="label">Message:</div>
                <div class="message-box">${message}</div>
              </div>
              
              <div class="field">
                <div class="label">Timestamp:</div>
                <div class="value">${new Date().toLocaleString()}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Swift Invoice <noreply@platovalabs.com>',
        to: ['support@platovalabs.com'],
        subject: `${categoryEmoji} Feedback: ${category.toUpperCase()} - Swift Invoice`,
        html: htmlContent,
        reply_to: email || undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend API error:', data)
      const errorMessage = data.message || 'Failed to send email'
      
      // Check for specific error types
      if (errorMessage.includes('SPF') || errorMessage.includes('domain')) {
        throw new Error('Email domain not properly configured. Please verify your domain\'s SPF records in Resend.')
      }
      
      throw new Error(errorMessage)
    }

    console.log('Feedback email sent successfully:', data.id)
    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending feedback:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check Supabase Edge Function logs for more information.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
