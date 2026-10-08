/**
 * Name pools for generated crew, by home country. Common given names and
 * surnames only — these are made-up people, not anyone in particular.
 */
import type { CountryCode } from './countries';

export const NAMES: Record<CountryCode, { first: string[]; last: string[] }> = {
  GB: {
    first: ['James', 'Sarah', 'Tom', 'Emma', 'Dave', 'Kate', 'Steve', 'Lucy', 'Mark', 'Jess', 'Gary', 'Claire', 'Rob', 'Hannah', 'Paul', 'Becky', 'Andy', 'Sophie', 'Neil', 'Laura', 'Pete', 'Gemma', 'Ian', 'Nicola'],
    last: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright', 'Hughes', 'Edwards', 'Green', 'Hall', 'Wood', 'Clarke', 'Harris', 'Lewis', 'Murphy', 'Reid', 'Turner', 'Price', 'Bennett', 'Kelly'],
  },
  US: {
    first: ['Mike', 'Jen', 'Chris', 'Ashley', 'Matt', 'Megan', 'Josh', 'Amanda', 'Ryan', 'Nicole', 'Kevin', 'Stephanie', 'Brian', 'Rachel', 'Tony', 'Heather', 'Jake', 'Tiffany', 'Dan', 'Maria', 'Carlos', 'Kim', 'Darnell', 'Lisa'],
    last: ['Johnson', 'Williams', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Martinez', 'Anderson', 'Jackson', 'White', 'Lopez', 'Lee', 'Harris', 'Young', 'King', 'Scott', 'Nguyen', 'Hill', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Collins'],
  },
  ES: {
    first: ['Javier', 'Laura', 'Carlos', 'María', 'David', 'Lucía', 'Sergio', 'Marta', 'Álvaro', 'Paula', 'Jorge', 'Elena', 'Pablo', 'Cristina', 'Raúl', 'Sara', 'Iñaki', 'Nerea', 'Jordi', 'Montse', 'Manolo', 'Pilar', 'Rubén', 'Ainhoa'],
    last: ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Gil', 'Vidal', 'Etxeberria'],
  },
  DE: {
    first: ['Lukas', 'Anna', 'Jonas', 'Laura', 'Felix', 'Julia', 'Tobias', 'Lena', 'Stefan', 'Katrin', 'Markus', 'Sabine', 'Jan', 'Nina', 'Florian', 'Sarah', 'Thomas', 'Claudia', 'Max', 'Jana', 'Sven', 'Miriam', 'Dirk', 'Anja'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Braun', 'Zimmermann', 'Krüger', 'Hartmann', 'Lange', 'Werner', 'Krause'],
  },
  FR: {
    first: ['Julien', 'Camille', 'Nicolas', 'Marie', 'Thomas', 'Léa', 'Antoine', 'Chloé', 'Maxime', 'Manon', 'Pierre', 'Sophie', 'Romain', 'Julie', 'Hugo', 'Céline', 'Olivier', 'Élodie', 'Kevin', 'Aurélie', 'Mehdi', 'Inès', 'Yann', 'Nadia'],
    last: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier'],
  },
  IT: {
    first: ['Marco', 'Giulia', 'Luca', 'Francesca', 'Alessandro', 'Chiara', 'Andrea', 'Sara', 'Matteo', 'Valentina', 'Davide', 'Elena', 'Simone', 'Federica', 'Lorenzo', 'Martina', 'Stefano', 'Silvia', 'Roberto', 'Paola', 'Gianni', 'Alessia', 'Fabio', 'Laura'],
    last: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani'],
  },
};
