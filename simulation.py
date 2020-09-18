import math
import random
import itertools
from time import sleep

from typing import List, Tuple

# Global variables
SPEED = 1
SIZE = 10
N_PERSONS = 20
INFECTED_PERCENTAGE = 0.2
MASKS_PERCENTAGE = 0.5
MINIMUM_DISTANCE = 1

INFECTED = math.floor(N_PERSONS * INFECTED_PERCENTAGE)
MASKS = math.floor(N_PERSONS * MASKS_PERCENTAGE)


class Move:
    TYPES = ["Stay", "Up", "Down", "Left", "Right", "Up-Left", "Up-Right", "Down-Left", "Down-Right"]
    LOCATION_INDEXES = []  # Occupied indexes in the map

    def __init__(self, initial_pos: tuple, move_type: str):
        self.x_init = initial_pos[0]
        self.x_dest = initial_pos[0]
        self.y_init = initial_pos[1]
        self.y_dest = initial_pos[1]
        if "Up" in move_type:
            self.y_dest -= 1
        if "Down" in move_type:
            self.y_dest += 1
        if "Left" in move_type:
            self.x_dest -= 1
        if "Right" in move_type:
            self.x_dest += 1

    def is_stay(self):
        return self.x_init == self.x_dest and self.y_init == self.y_dest

    def in_map(self):
        return 0 <= self.x_dest < SIZE and 0 <= self.y_dest < SIZE

    def to_free_pos(self):
        return (self.x_dest, self.y_dest) not in Move.LOCATION_INDEXES

    def is_valid(self):
        return self.is_stay() or (self.in_map() and self.to_free_pos())

    def update_indexes(self):
        if not self.is_stay():  # Avoid removing and appending the same element to list
            Move.LOCATION_INDEXES.remove((self.x_init, self.y_init))
            Move.LOCATION_INDEXES.append((self.x_dest, self.y_dest))


class Person:
    __id = 0
    # Probabilities of infection based on wearing masks or not. First element: infected, second: to_infect
    PROBABILITIES = {(False, False): 0.9, (False, True): 0.7, (True, False): 0.05, (True, True): 0.015}

    def __init__(self, x: int, y: int, infected: bool, mask: bool):
        self.id = Person.__id
        Person.__id += 1
        self.x = x
        self.y = y
        self.is_infected = infected
        self.wearing_mask = mask

    def __str__(self):
        return f"Person [{self.id}]: {'🦠' if self.is_infected else '🧑'} {'😷' if self.wearing_mask else '😞'}"

    def is_close(self, other: 'Person'):
        """
        :param other
        :return: True if two persons are closer than the minimum_distance
        """
        return abs(self.x - other.x) <= MINIMUM_DISTANCE and abs(self.y - other.y) <= MINIMUM_DISTANCE

    def should_infect(self, to_infect: 'Person') -> bool:
        """
        Function called by the INFECTED to check if he should infect to_infect,
        executing a random test based on probabilities depending on wearing masks
        :param to_infect: Person
        :return: True if infected, False if not
        """
        probability = Person.PROBABILITIES[self.wearing_mask, to_infect.wearing_mask]
        return random.random() < probability

    @staticmethod
    def check_infection(person1: 'Person', person2: 'Person') -> Tuple[bool, bool]:
        """
        Checks if there is a new infection between the two persons, returning a boolean tuple
        indicating if any of them got infected
        :param person1:
        :param person2:
        :return: p1_got_infected, p2_got_infected
        """
        # Discard if contagion is impossible to happen
        if not person1.is_close(person2) or (person1.is_infected and person2.is_infected) or \
                (not person1.is_infected and not person2.is_infected):
            return False, False

        if person1.is_infected and person1.should_infect(person2):
            return False, True
        elif person2.is_infected and person2.should_infect(person1):
            return True, False
        else:
            return False, False

    def move(self):
        """
        Chooses a random order of directions and tries to move until one is valid, updating the map
        """
        move_types = list(Move.TYPES)
        random.shuffle(move_types)
        for move_type in move_types:
            move = Move(initial_pos=(self.x, self.y), move_type=move_type)
            if move.is_valid():
                move.update_indexes()
                print(f"[{self}] ({self.x}, {self.y}) -> ({move.x_dest}, {move.y_dest})")
                self.x, self.y = move.x_dest, move.y_dest
                break


def population_init() -> List[Person]:
    """
    Choose position, if infected and if masked for each Person, following proportions
    :return: array with all persons created (population)
    """
    # Randomly choose initial position of each Person
    total_indexes = [(i, j) for i in range(SIZE) for j in range(SIZE)]
    Move.LOCATION_INDEXES = random.sample(total_indexes, k=N_PERSONS)

    # Randomly choose who is infected and who will wear a mask
    infected_indexes = [True]*INFECTED + [False]*(N_PERSONS-INFECTED)
    masks_indexes = [True]*MASKS + [False]*(N_PERSONS-MASKS)
    random.shuffle(infected_indexes)
    random.shuffle(masks_indexes)

    population = []
    for (x, y), infected, mask in zip(Move.LOCATION_INDEXES, infected_indexes, masks_indexes):
        population.append(Person(x, y, infected, mask))

    return population


def simulation():
    global INFECTED

    population = population_init()

    while INFECTED < N_PERSONS:
        sleep(1/SPEED)
        """
        Infection update will be done after checking infections among all the population
        This is done to avoid one person getting infected and infecting another at the
        same moment due to loop order
        """
        should_update = [False] * N_PERSONS
        for person1, person2 in itertools.combinations(population, 2):
            p1_got_infected, p2_got_infected = Person.check_infection(person1, person2)
            should_update[person1.id] = should_update[person1.id] or p1_got_infected
            should_update[person2.id] = should_update[person2.id] or p2_got_infected

        random.shuffle(population)  # Shuffle population so move order is always different
        for person in population:
            if should_update[person.id]:
                INFECTED += 1
                person.is_infected = True

            person.move()

        print(f"TOTAL INFECTED: {INFECTED}")

    print("All the population got infected...")


if __name__ == '__main__':
    simulation()
