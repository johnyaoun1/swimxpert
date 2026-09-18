import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';

export interface FaqItem {
  question: string;
  answerLead: string;
  answerDetail?: string;
}

const FAQ_JSON_LD_ID = 'swimxpert-faq-jsonld';

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.scss']
})
export class FaqComponent implements OnInit, OnDestroy {
  readonly faqs: FaqItem[] = [
    {
      question: 'How much do swimming lessons cost in Lebanon?',
      answerLead:
        'SwimXpert lesson prices vary by package, level, and session type — contact us for current rates.',
      answerDetail:
        'We offer private, semi-private, and adult options. Message us via the contact form or WhatsApp and we will share the latest pricing for your program.'
    },
    {
      question: 'What age can my child start private swimming lessons?',
      answerLead: 'Private swimming lessons at SwimXpert start from 2.5 years old.',
      answerDetail:
        'Younger swimmers begin with water comfort and safety fundamentals in one-on-one sessions paced for their age.'
    },
    {
      question: 'What age can kids start swimming lessons?',
      answerLead:
        'Kids can start SwimXpert private lessons from 2.5 years old; semi-private groups are available as they are ready for shared sessions.',
      answerDetail:
        'Our Level Finder quiz helps place swimmers in the right program. If you are unsure, book a consultation and a coach will advise.'
    },
    {
      question: 'Do you offer group swimming lessons?',
      answerLead: 'Yes — SwimXpert offers semi-private group lessons for 2, 3, or 4 children.',
      answerDetail:
        'Semi-private sessions keep groups small so each child still gets focused coaching while learning with peers.'
    },
    {
      question: 'What other water programs does SwimXpert offer besides swimming lessons?',
      answerLead: 'Besides swimming lessons, SwimXpert offers aqua therapy and aqua gym.',
      answerDetail:
        'Aqua therapy supports therapeutic movement in the water; aqua gym is pool-based fitness training. Contact us to ask which program fits your goals.'
    },
    {
      question: 'What certifications do SwimXpert’s coaches hold?',
      answerLead:
        'SwimXpert coaches hold ASCA certification (Levels 1–3), the SAS swimming diploma, and official lifeguard certification from Lebanon’s Ministry of Tourism (Wizarat Al-Siyaha).',
      answerDetail:
        'These credentials cover coaching standards and water safety so every session is led by qualified staff.'
    },
    {
      question: 'Do you offer adult swimming lessons?',
      answerLead: 'Yes — SwimXpert offers swimming lessons for adults as well as children.',
      answerDetail:
        'Adult programs cover beginners learning water confidence through stroke technique and fitness swimming. Tell us your goals when you contact us or create an account.'
    },
    {
      question: 'Where is SwimXpert located?',
      answerLead:
        'SwimXpert runs lessons at Cap Sur Ville Country Club in the Dekwaneh / Mar Roukoz area of Beirut, Lebanon.',
      answerDetail:
        'We also serve Tilal Fanar. See the Locations page for addresses, maps, and seasonal notes — programs pause October through December.'
    },
    {
      question: 'How do I book a session?',
      answerLead:
        'Create a SwimXpert account (or log in), then book from available sessions — or contact us and we will help you schedule.',
      answerDetail:
        'New swimmers often start with the Level Finder to pick the right class. After signup, browse available sessions or reach out via Contact and we will place you.'
    }
  ];

  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'FAQ | Swimming Lessons Lebanon | SwimXpert',
      description:
        'Answers about SwimXpert swimming lessons in Lebanon: ages from 2.5, semi-private groups, aqua therapy, aqua gym, coach certifications, pricing, and booking.',
      path: '/faq',
      keywords:
        'private swimming lessons from 2.5, semi-private swimming groups lebanon, aqua therapy beirut, aqua gym, ASCA coach certification, SwimXpert FAQ'
    });

    this.seo.setJsonLd(FAQ_JSON_LD_ID, {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqs.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answerDetail
            ? `${item.answerLead} ${item.answerDetail}`
            : item.answerLead
        }
      }))
    });
  }

  ngOnDestroy(): void {
    this.seo.removeJsonLd(FAQ_JSON_LD_ID);
  }
}
